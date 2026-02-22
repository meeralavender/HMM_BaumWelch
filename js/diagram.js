/**
 * Enhanced Visualization for HMM State Transition Diagram
 */
class StateDiagram {
    constructor(containerId) {
        this.containerId = containerId;
        this.svg = d3.select("#state-diagram");
        this.tooltip = d3.select("#tooltip");
        this.init();
    }

    init() {
        this.svg.selectAll("*").remove();

        // Marker for arrows
        this.svg.append("defs").selectAll("marker")
            .data(["classic", "dashed"])
            .enter().append("marker")
            .attr("id", d => `arrow-${d}`)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 28)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .style("fill", "#868e96");

        this.gLinks = this.svg.append("g").attr("class", "links");
        this.gNodes = this.svg.append("g").attr("class", "nodes");

        window.addEventListener("resize", () => this.resize());
    }

    resize() {
        const container = document.getElementById(this.containerId);
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        if (this.currentHMM) this.update(this.currentHMM);
    }

    update(hmm) {
        this.currentHMM = hmm;
        const container = document.getElementById(this.containerId);
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        const N = hmm.N;
        const M = hmm.M;
        const colors = ["#fd7e14", "#228be6", "#be4bdb", "#40c057", "#fab005"];

        // 1. Layout Nodes
        const nodes = [];

        // START node
        nodes.push({ id: "start", type: "start", x: this.width / 2, y: 60, name: "START" });

        // Hidden States nodes (Horizontal line in middle)
        const stateY = this.height / 2;
        const horizontalSpacing = this.width / (N + 1);
        for (let i = 0; i < N; i++) {
            nodes.push({
                id: `s${i}`,
                type: "state",
                index: i,
                x: horizontalSpacing * (i + 1),
                y: stateY,
                name: `S${i}`,
                color: colors[i % colors.length]
            });
        }

        // Observation nodes (Row at bottom)
        const obsY = this.height - 80;
        const obsSpacing = this.width / (M + 1);
        for (let j = 0; j < M; j++) {
            nodes.push({
                id: `o${j}`,
                type: "obs",
                index: j,
                x: obsSpacing * (j + 1),
                y: obsY,
                name: `O${j}`
            });
        }

        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // 2. Prepare Links
        const links = [];

        // Pi links (START -> states)
        for (let i = 0; i < N; i++) {
            links.push({
                source: "start",
                target: `s${i}`,
                value: hmm.pi[i],
                type: "pi",
                label: `π=${hmm.pi[i].toFixed(2)}`
            });
        }

        // Transition links (A: states -> states)
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                if (hmm.A[i][j] > 0.05) {
                    links.push({
                        source: `s${i}`,
                        target: `s${j}`,
                        value: hmm.A[i][j],
                        type: "transition",
                        isSelf: i === j,
                        label: hmm.A[i][j].toFixed(2)
                    });
                }
            }
        }

        // Emission links (B: states -> observations)
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                if (hmm.B[i][j] > 0.05) {
                    links.push({
                        source: `s${i}`,
                        target: `o${j}`,
                        value: hmm.B[i][j],
                        type: "emission",
                        label: hmm.B[i][j].toFixed(2)
                    });
                }
            }
        }

        this.render(nodes, links, nodeMap);
    }

    render(nodes, links, nodeMap) {
        const self = this;

        // Render Links
        const link = this.gLinks.selectAll(".link-group")
            .data(links, d => `${d.source}-${d.target}-${d.type}`);

        const linkEnter = link.enter().append("g").attr("class", "link-group");

        linkEnter.append("path")
            .attr("class", d => `link-line ${d.type}`);

        linkEnter.append("text")
            .attr("class", "link-prob");

        const linkCombined = linkEnter.merge(link);

        linkCombined.select("path")
            .transition().duration(400)
            .attr("d", d => {
                const s = nodeMap.get(d.source);
                const t = nodeMap.get(d.target);
                if (d.isSelf) {
                    const r = 30;
                    return `M ${s.x - 10} ${s.y - 25} A ${r} ${r} 0 1 1 ${s.x + 10} ${s.y - 25}`;
                }
                if (d.type === "transition") {
                    const dx = t.x - s.x;
                    const dy = t.y - s.y;
                    const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
                    return `M ${s.x} ${s.y} A ${dr} ${dr} 0 0,1 ${t.x} ${t.y}`;
                }
                return `M ${s.x} ${s.y} L ${t.x} ${t.y}`;
            })
            .attr("marker-end", d => d.type === "emission" ? "none" : "url(#arrow-classic)")
            .style("stroke-dasharray", d => d.type === "emission" ? "4,4" : "none")
            .style("stroke-width", d => Math.max(1, d.value * 5))
            .style("opacity", d => 0.1 + d.value * 0.9);

        linkCombined.select("text")
            .transition().duration(400)
            .attr("x", d => {
                const s = nodeMap.get(d.source);
                const t = nodeMap.get(d.target);
                if (d.isSelf) return s.x;
                if (d.type === "transition") return (s.x + t.x) / 2 + (t.y - s.y) * 0.1;
                return (s.x + t.x) / 2;
            })
            .attr("y", d => {
                const s = nodeMap.get(d.source);
                const t = nodeMap.get(d.target);
                if (d.isSelf) return s.y - 70;
                if (d.type === "transition") return (s.y + t.y) / 2 - (t.x - s.x) * 0.1;
                return (s.y + t.y) / 2;
            })
            .text(d => d.label);

        link.exit().remove();

        // Render Nodes
        const node = this.gNodes.selectAll(".node-group")
            .data(nodes, d => d.id);

        const nodeEnter = node.enter().append("g")
            .attr("class", d => `node-group type-${d.type}`)
            .on("mouseover", function (event, d) {
                self.tooltip.classed("hidden", false)
                    .html(d.type === "state" ? `State ${d.name}` : d.name)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mousemove", (event) => {
                self.tooltip.style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", () => self.tooltip.classed("hidden", true));

        // Start node: Rounded rect
        nodeEnter.filter(d => d.type === "start").append("rect")
            .attr("class", "start-pill")
            .attr("x", -40).attr("y", -20)
            .attr("width", 80).attr("height", 40)
            .attr("rx", 20);

        // State nodes: Circle with gradient/color
        nodeEnter.filter(d => d.type === "state").append("circle")
            .attr("class", "node-circle")
            .attr("r", 30)
            .style("fill", d => d.color)
            .style("stroke", "white").style("stroke-width", "2px");

        // Obs nodes: Rect
        nodeEnter.filter(d => d.type === "obs").append("rect")
            .attr("class", "obs-rect")
            .attr("x", -30).attr("y", -15)
            .attr("width", 60).attr("height", 30)
            .attr("rx", 4);

        nodeEnter.append("text")
            .attr("class", "node-label")
            .attr("dy", d => d.type === "obs" ? 5 : 5)
            .attr("text-anchor", "middle")
            .style("fill", d => d.type === "state" ? "white" : "var(--text-primary)")
            .text(d => d.name);

        const nodeCombined = nodeEnter.merge(node);
        nodeCombined.transition().duration(400)
            .attr("transform", d => `translate(${d.x},${d.y})`);

        node.exit().remove();
    }
}
