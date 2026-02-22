# Hidden Markov Model (HMM) Baum-Welch Visualizer

An interactive web-based dashboard for visualizing and training Hidden Markov Models using the Baum-Welch (Forward-Backward) algorithm.

## Developer Information
- **Name:** Meera Nandita S
- **University Registration Number:** TCR24CS045


## Features
- **Real-time Training:** Visualize the Baum-Welch (EM) algorithm as it iterates.
- **Multi-Layer Diagram:** Interactive D3.js visualization showing:
  - **Start node** (Initial probabilities π)
  - **Hidden states** (Transition probabilities A)
  - **Observation nodes** (Emission probabilities B)
- **Advanced Configuration:** Set Max Iterations, Tolerance, and use **Weather/DNA Presets**.
- **Live Benchmarking:** Monitor Log-Likelihood and Observation Probability convergence live.
- **Detailed Result Tables:** Formatted matrices (A, B, π) generated upon completion.

## Technology Stack
- **Structure:** HTML5 Semantic elements
- **Styling:** CSS3 with Glassmorphism and Dark Theme
- **Visualization:** D3.js (State Diagram)
- **Plotting:** Chart.js (Convergence Curves)
- **Engine:** Vanilla JavaScript (Numerical implementation of Forward-Backward & Baum-Welch)

## How to Run
1. Clone this repository.
2. Open `index.html` in any modern web browser.
3. Adjust the Configuration in the sidebar if needed.
4. Click **"Train Model"** to see the algorithm in action.

## About the Algorithm
The **Baum–Welch algorithm** is a special case of the Expectation-Maximization (EM) algorithm used to find the unknown parameters of a Hidden Markov Model (HMM). It finds the (locally) maximum likelihood estimate of the parameters of an HMM given a set of observed feature vectors.

1. **Expectation (E-step):** Calculates the "expected" number of times each state and transition is used, given the current model parameters and observations (Forward-Backward probabilities).
2. **Maximization (M-step):** Re-estimates the model parameters (Pi, A, B) based on the counts calculated in the E-step.
3. **Iteration:** Repeats until the Log-Likelihood of the observations stops increasing significantly.

---
*Created for educational purposes.*
