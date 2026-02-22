/**
 * Hidden Markov Model (HMM) implementation with Baum-Welch Training
 */
class HMM {
    constructor(nStates, nSymbols) {
        this.N = nStates; // Number of hidden states
        this.M = nSymbols; // Number of observation symbols

        // Initial state distribution (Pi)
        this.pi = new Array(this.N).fill(1 / this.N);

        // Transition probability matrix (A) [N x N]
        this.A = Array.from({ length: this.N }, () => new Array(this.N).fill(1 / this.N));

        // Emission probability matrix (B) [N x M]
        this.B = Array.from({ length: this.N }, () => new Array(this.M).fill(1 / this.M));

        this.randomize();
    }

    randomize() {
        const randSum = (arr) => {
            const sum = arr.reduce((a, b) => a + Math.random(), 0);
            return arr.map(() => Math.random() / sum);
        }

        // Randomize Pi
        let sumPi = 0;
        for (let i = 0; i < this.N; i++) {
            this.pi[i] = Math.random();
            sumPi += this.pi[i];
        }
        this.pi = this.pi.map(v => v / sumPi);

        // Randomize A
        for (let i = 0; i < this.N; i++) {
            let sumA = 0;
            for (let j = 0; j < this.N; j++) {
                this.A[i][j] = Math.random();
                sumA += this.A[i][j];
            }
            this.A[i] = this.A[i].map(v => v / sumA);
        }

        // Randomize B
        for (let i = 0; i < this.N; i++) {
            let sumB = 0;
            for (let j = 0; j < this.M; j++) {
                this.B[i][j] = Math.random();
                sumB += this.B[i][j];
            }
            this.B[i] = this.B[i].map(v => v / sumB);
        }
    }

    /**
     * Forward algorithm (Alpha)
     * @param {Array} obs Observation sequence
     * @returns {Object} { alpha, logLikelihood, scales }
     */
    forward(obs) {
        const T = obs.length;
        const alpha = Array.from({ length: T }, () => new Array(this.N).fill(0));
        const scales = new Array(T).fill(0);

        // Initialization
        for (let i = 0; i < this.N; i++) {
            alpha[0][i] = this.pi[i] * this.B[i][obs[0]];
            scales[0] += alpha[0][i];
        }

        // Scale alpha[0]
        if (scales[0] === 0) scales[0] = 1e-10;
        for (let i = 0; i < this.N; i++) {
            alpha[0][i] /= scales[0];
        }

        // Induction
        for (let t = 1; t < T; t++) {
            for (let j = 0; j < this.N; j++) {
                let sum = 0;
                for (let i = 0; i < this.N; i++) {
                    sum += alpha[t - 1][i] * this.A[i][j];
                }
                alpha[t][j] = sum * this.B[j][obs[t]];
                scales[t] += alpha[t][j];
            }

            // Scale alpha[t]
            if (scales[t] === 0) scales[t] = 1e-10;
            for (let j = 0; j < this.N; j++) {
                alpha[t][j] /= scales[t];
            }
        }

        const logLikelihood = scales.reduce((a, b) => a + Math.log(b), 0);
        return { alpha, logLikelihood, scales };
    }

    /**
     * Backward algorithm (Beta)
     * @param {Array} obs Observation sequence
     * @param {Array} scales Scaling factors from forward algorithm
     * @returns {Array} beta matrix
     */
    backward(obs, scales) {
        const T = obs.length;
        const beta = Array.from({ length: T }, () => new Array(this.N).fill(0));

        // Initialization
        for (let i = 0; i < this.N; i++) {
            beta[T - 1][i] = 1.0 / scales[T - 1];
        }

        // Induction
        for (let t = T - 2; t >= 0; t--) {
            for (let i = 0; i < this.N; i++) {
                let sum = 0;
                for (let j = 0; j < this.N; j++) {
                    sum += this.A[i][j] * this.B[j][obs[t + 1]] * beta[t + 1][j];
                }
                beta[t][i] = sum / scales[t];
            }
        }

        return beta;
    }

    /**
     * Baum-Welch (EM) Iteration
     * @param {Array} obs Observation sequence
     * @returns {number} New Log-Likelihood
     */
    trainIteration(obs) {
        const T = obs.length;
        const { alpha, logLikelihood, scales } = this.forward(obs);
        const beta = this.backward(obs, scales);

        // Compute Gamma (state occupancy) and Xi (transition occupancy)
        const gamma = Array.from({ length: T }, () => new Array(this.N).fill(0));
        const xi = Array.from({ length: T - 1 }, () =>
            Array.from({ length: this.N }, () => new Array(this.N).fill(0))
        );

        for (let t = 0; t < T; t++) {
            let sumGamma = 0;
            for (let i = 0; i < this.N; i++) {
                gamma[t][i] = alpha[t][i] * beta[t][i] * scales[t];
                sumGamma += gamma[t][i];
            }
            // Normalize gamma
            if (sumGamma > 0) {
                for (let i = 0; i < this.N; i++) gamma[t][i] /= sumGamma;
            }

            if (t < T - 1) {
                let sumXi = 0;
                for (let i = 0; i < this.N; i++) {
                    for (let j = 0; j < this.N; j++) {
                        xi[t][i][j] = alpha[t][i] * this.A[i][j] * this.B[j][obs[t + 1]] * beta[t + 1][j];
                        sumXi += xi[t][i][j];
                    }
                }
                // Normalize xi
                if (sumXi > 0) {
                    for (let i = 0; i < this.N; i++) {
                        for (let j = 0; j < this.N; j++) xi[t][i][j] /= sumXi;
                    }
                }
            }
        }

        // Re-estimation step
        // Update Pi
        for (let i = 0; i < this.N; i++) {
            this.pi[i] = gamma[0][i];
        }

        // Update A
        for (let i = 0; i < this.N; i++) {
            let denom = 0;
            for (let t = 0; t < T - 1; t++) denom += gamma[t][i];

            for (let j = 0; j < this.N; j++) {
                let num = 0;
                for (let t = 0; t < T - 1; t++) num += xi[t][i][j];
                this.A[i][j] = (denom > 0) ? num / denom : 0;
            }
        }

        // Update B
        for (let j = 0; j < this.N; j++) {
            let denom = 0;
            for (let t = 0; t < T; t++) denom += gamma[t][j];

            for (let k = 0; k < this.M; k++) {
                let num = 0;
                for (let t = 0; t < T; t++) {
                    if (obs[t] === k) num += gamma[t][j];
                }
                this.B[j][k] = (denom > 0) ? num / denom : 0;
            }
        }

        return { logLikelihood, alpha, beta, gamma };
    }
}
