/**
 * Enhanced App Controller for HMM Baum-Welch Visualizer
 */
class App {
    constructor() {
        this.hmm = null;
        this.diagram = new StateDiagram("diagram-container");
        this.charts = { loglik: null, prob: null, nll: null, complement: null, evolution: null };
        this.trainingInterval = null;
        this.observations = [];
        this.history = []; // Array of { iter, logL, delta, prob, nll, complement, A, B, pi }
        this.lastIntermediates = null; // { alpha, beta, gamma }

        this.init();
    }

    init() {
        this.setupCharts();
        this.setupEventListeners();
        this.reset();
    }

    setupCharts() {
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true, text: 'Iteration' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { display: true, grid: { color: 'rgba(255,255,255,0.05)' } }
            },
            plugins: { legend: { display: false } },
            elements: { point: { radius: 0 } }
        };

        this.charts.loglik = new Chart(document.getElementById('chart-loglik'), {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderColor: '#4dadf7', backgroundColor: 'rgba(77, 173, 247, 0.1)', fill: true, tension: 0.3 }] },
            options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { display: true, text: 'log P(O|λ)' } } } }
        });

        this.charts.prob = new Chart(document.getElementById('chart-prob'), {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderColor: '#40c057', backgroundColor: 'rgba(64, 192, 87, 0.1)', fill: true, tension: 0.3 }] },
            options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { display: true, text: 'P(O|λ)' } } } }
        });

        this.charts.nll = new Chart(document.getElementById('chart-nll'), {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderColor: '#fa5252', backgroundColor: 'rgba(250, 82, 82, 0.1)', fill: true, tension: 0.3 }] },
            options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { display: true, text: 'NLL (-log P)' } } } }
        });

        this.charts.complement = new Chart(document.getElementById('chart-complement'), {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderColor: '#be4bdb', backgroundColor: 'rgba(190, 75, 219, 0.1)', fill: true, tension: 0.3 }] },
            options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { display: true, text: '1 - P(O|λ)^(1/T)' } } } }
        });

        this.charts.evolution = new Chart(document.getElementById('chart-evolution'), {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: { ...commonOptions, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }
        });
    }

    setupEventListeners() {
        document.getElementById('btn-train').addEventListener('click', () => this.toggleTraining());
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());
        document.getElementById('btn-weather').addEventListener('click', () => this.loadPreset('weather'));
        document.getElementById('btn-dna').addEventListener('click', () => this.loadPreset('dna'));

        // Main Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.remove('hidden');
            });
        });

        // Sub Tabs
        document.querySelectorAll('.tab-sub-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-sub-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.subtab-content').forEach(c => c.classList.add('hidden'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.subtab).classList.remove('hidden');
            });
        });

        ['input-states', 'input-obs'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.reset());
        });
    }

    loadPreset(type) {
        if (type === 'weather') {
            document.getElementById('input-states').value = 2;
            document.getElementById('input-obs').value = "0, 1, 2, 0, 1, 2, 0, 0, 2, 1, 0, 2";
        } else if (type === 'dna') {
            document.getElementById('input-states').value = 2;
            document.getElementById('input-obs').value = "0, 1, 2, 3, 0, 2, 1, 3, 0, 0, 3, 2, 1, 0, 3, 2";
        }
        this.reset();
    }

    reset() {
        this.stopTraining();

        const N = Math.max(1, parseInt(document.getElementById('input-states').value));
        const obsStr = document.getElementById('input-obs').value;
        this.observations = obsStr.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));

        if (this.observations.length === 0) return;

        const M = Math.max(1, Math.max(...this.observations) + 1);
        this.hmm = new HMM(N, M);
        this.history = [];
        this.lastIntermediates = null;

        // UI Reset
        this.updateMetrics(0, null, null, 'Idle');
        this.clearCharts();
        this.initEvolutionChart();
        this.diagram.update(this.hmm);
        this.renderResultTables(false);
        this.renderLogTable(true); // Clear table

        document.getElementById('btn-train').textContent = "Train Model";
        document.getElementById('btn-train').classList.remove('danger-btn');
    }

    initEvolutionChart() {
        const N = this.hmm.N;
        const colors = ["#fd7e14", "#228be6", "#be4bdb", "#40c057", "#fab005", "#e64980", "#15aabf", "#82c91e"];
        const datasets = [];
        let colorIdx = 0;
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                datasets.push({
                    label: `A[${i}][${j}]`,
                    data: [],
                    borderColor: colors[colorIdx % colors.length],
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.1
                });
                colorIdx++;
            }
        }
        this.charts.evolution.data.datasets = datasets;
        this.charts.evolution.update();
    }

    toggleTraining() {
        if (this.trainingInterval) this.stopTraining();
        else this.startTraining();
    }

    startTraining() {
        const btn = document.getElementById('btn-train');
        btn.textContent = "Stop Training";
        btn.classList.add('danger-btn');
        document.getElementById('metric-status').className = 'val status-running';
        document.getElementById('metric-status').textContent = 'Training...';

        const maxIter = parseInt(document.getElementById('input-max-iter').value) || 150;
        const tolerance = parseFloat(document.getElementById('input-tolerance').value) || 1e-8;

        this.renderLogTable(false); // Setup headers
        let lastL = null;
        let iter = 0;

        this.trainingInterval = setInterval(() => {
            const result = this.hmm.trainIteration(this.observations);
            const currentL = result.logLikelihood;
            this.lastIntermediates = result;
            iter++;

            const delta = lastL !== null ? Math.abs(currentL - lastL) : 0;
            const prob = Math.exp(currentL);
            const nll = -currentL;
            const complement = 1 - Math.pow(prob, 1 / this.observations.length);

            const record = {
                iter, logL: currentL, delta, prob, nll, complement,
                A: JSON.parse(JSON.stringify(this.hmm.A)),
                B: JSON.parse(JSON.stringify(this.hmm.B)),
                pi: [...this.hmm.pi]
            };
            this.history.push(record);

            this.updateMetrics(iter, currentL, delta, 'Training...');
            this.updateCharts(record);
            this.diagram.update(this.hmm);
            this.appendLogEntry(record);

            if ((delta !== 0 && delta < tolerance) || iter >= maxIter) {
                this.finishTraining(iter, currentL, prob, delta < tolerance && delta !== 0);
            }

            lastL = currentL;
        }, 100);
    }

    finishTraining(iter, logL, prob, converged) {
        this.stopTraining();
        const status = converged ? 'Converged' : 'Finished';
        document.getElementById('metric-status').className = `val status-${converged ? 'converged' : 'idle'}`;
        document.getElementById('metric-status').textContent = status;

        document.getElementById('sum-iter').textContent = iter;
        document.getElementById('sum-loglik').textContent = logL.toFixed(6);
        document.getElementById('sum-prob').textContent = prob.toExponential(4);
        document.getElementById('sum-converged').textContent = converged ? 'Yes' : 'No';

        this.renderResultTables(true);
        this.renderIntermediateTables();
    }

    stopTraining() {
        if (this.trainingInterval) {
            clearInterval(this.trainingInterval);
            this.trainingInterval = null;
            document.getElementById('btn-train').textContent = "Resume Training";
        }
    }

    updateMetrics(iter, logL, delta, status) {
        document.getElementById('metric-iter').textContent = iter;
        document.getElementById('metric-loglik').textContent = logL !== null ? logL.toFixed(6) : '-';
        document.getElementById('metric-delta').textContent = delta !== null ? delta.toExponential(4) : '-';
    }

    updateCharts(record) {
        const iter = record.iter;
        this.charts.loglik.data.labels.push(iter);
        this.charts.loglik.data.datasets[0].data.push(record.logL);
        this.charts.loglik.update('none');

        this.charts.prob.data.labels.push(iter);
        this.charts.prob.data.datasets[0].data.push(record.prob);
        this.charts.prob.update('none');

        this.charts.nll.data.labels.push(iter);
        this.charts.nll.data.datasets[0].data.push(record.nll);
        this.charts.nll.update('none');

        this.charts.complement.data.labels.push(iter);
        this.charts.complement.data.datasets[0].data.push(record.complement);
        this.charts.complement.update('none');

        // Evolution chart
        this.charts.evolution.data.labels.push(iter);
        let datasetIdx = 0;
        for (let i = 0; i < this.hmm.N; i++) {
            for (let j = 0; j < this.hmm.N; j++) {
                this.charts.evolution.data.datasets[datasetIdx].data.push(record.A[i][j]);
                datasetIdx++;
            }
        }
        this.charts.evolution.update('none');
    }

    clearCharts() {
        Object.values(this.charts).forEach(chart => {
            chart.data.labels = [];
            chart.data.datasets.forEach(ds => ds.data = []);
            chart.update();
        });
    }

    renderLogTable(clear = false) {
        const body = document.getElementById('log-body');
        const header = document.getElementById('log-header');
        if (clear) {
            body.innerHTML = "";
            header.innerHTML = "<th>ITER</th><th>LOG-LIKELIHOOD</th><th>Δ ALL</th>";
            return;
        }
        // Build headers for all parameters
        header.innerHTML = "<th>ITER</th><th>LOG-LIKELIHOOD</th><th>Δ ALL</th>";
        for (let i = 0; i < this.hmm.N; i++) {
            for (let j = 0; j < this.hmm.N; j++) {
                header.innerHTML += `<th>A[${i}][${j}]</th>`;
            }
        }
        for (let i = 0; i < this.hmm.N; i++) {
            for (let j = 0; j < this.hmm.M; j++) {
                header.innerHTML += `<th>B[${i}][${j}]</th>`;
            }
        }
        for (let i = 0; i < this.hmm.N; i++) {
            header.innerHTML += `<th>π[${i}]</th>`;
        }
    }

    appendLogEntry(record) {
        const body = document.getElementById('log-body');
        const row = document.createElement('tr');

        let html = `<td>${record.iter}</td>`;
        html += `<td>${record.logL.toFixed(6)}</td>`;
        html += `<td>${record.delta.toExponential(4)}</td>`;

        for (let i = 0; i < this.hmm.N; i++) {
            for (let j = 0; j < this.hmm.N; j++) {
                html += `<td>${record.A[i][j].toFixed(4)}</td>`;
            }
        }
        for (let i = 0; i < this.hmm.N; i++) {
            for (let j = 0; j < this.hmm.M; j++) {
                html += `<td>${record.B[i][j].toFixed(4)}</td>`;
            }
        }
        for (let i = 0; i < this.hmm.N; i++) {
            html += `<td>${record.pi[i].toFixed(4)}</td>`;
        }

        row.innerHTML = html;
        body.insertBefore(row, body.firstChild);
    }

    renderIntermediateTables() {
        if (!this.lastIntermediates) return;
        const { alpha, beta, gamma } = this.lastIntermediates;

        const renderMatrixTable = (matrix, containerId) => {
            const container = document.getElementById(containerId);
            let html = `<table><thead><tr><th>T</th>`;
            for (let i = 0; i < this.hmm.N; i++) html += `<th>S${i}</th>`;
            html += `</tr></thead><tbody>`;

            // Show first 20 time steps only as per screenshot
            const limit = Math.min(matrix.length, 20);
            for (let t = 0; t < limit; t++) {
                html += `<tr><td>${t}</td>`;
                for (let i = 0; i < this.hmm.N; i++) {
                    const val = matrix[t][i];
                    html += `<td>${val === 0 ? '0.0000e+0' : val.toExponential(4)}</td>`;
                }
                html += `</tr>`;
            }
            html += `</tbody></table>`;
            container.innerHTML = html;
        };

        renderMatrixTable(alpha, 'table-alpha');
        renderMatrixTable(beta, 'table-beta');
        renderMatrixTable(gamma, 'table-gamma');
    }

    renderResultTables(visible) {
        const containers = {
            a: document.getElementById('matrix-a-container'),
            b: document.getElementById('matrix-b-container'),
            pi: document.getElementById('matrix-pi-container')
        };
        if (!visible) { Object.values(containers).forEach(c => c.innerHTML = ""); return; }

        const render = (data, rows, rLab, cLab) => {
            let h = `<table><thead><tr><th></th>`;
            for (let j = 0; j < data[0].length; j++) h += `<th>${cLab}${j}</th>`;
            h += `</tr></thead><tbody>`;
            for (let i = 0; i < rows; i++) {
                h += `<tr><th>${rLab}${i}</th>`;
                for (let j = 0; j < data[i].length; j++) h += `<td>${data[i][j].toFixed(6)}</td>`;
                h += `</tr>`;
            }
            return h + `</tbody></table>`;
        };

        containers.a.innerHTML = render(this.hmm.A, this.hmm.N, 'S', 'S');
        containers.b.innerHTML = render(this.hmm.B, this.hmm.N, 'S', 'O');

        let hp = `<table><thead><tr>`;
        for (let i = 0; i < this.hmm.N; i++) hp += `<th>π(S${i})</th>`;
        hp += `</tr></thead><tbody><tr>`;
        for (let i = 0; i < this.hmm.N; i++) hp += `<td>${this.hmm.pi[i].toFixed(6)}</td>`;
        hp += `</tr></tbody></table>`;
        containers.pi.innerHTML = hp;
    }
}

window.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
