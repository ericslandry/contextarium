// World units. Displayed pixel size is the font size multiplied by the camera transform.
export const layoutContract = {
  version: 1,
  boardHeading: { minimumDepth: 200, clearance: 24 },
  readableTextPx: 12,
  padding: { horizontal: [20, 44], vertical: [16, 40], gap: [8, 16] },
  typography: {
    label: [16, 18], title: [30, 42], body: [20, 26], metric: [52, 100],
    list: [20, 24], button: [18, 22], boardTitle: 60
  },
  components: {
    board: { minimum: [640, 400], recommended: [1200, 800], capacity: "One label, heading and short introduction. Keep children below the heading zone." },
    text: { minimum: [320, 180], recommended: [640, 320], capacity: "One short title and up to three short lines at the recommended size." },
    metric: { minimum: [320, 220], recommended: [480, 300], capacity: "A short label and title plus one compact value. Use a separate card for explanation." },
    list: { minimum: [400, 220], recommended: [680, 420], capacity: "Up to five short, single-line entries at the recommended size." },
    chart: { minimum: [430, 240], recommended: [720, 460], capacity: "Up to five short bar labels with values at the recommended size." },
    table: { minimum: [400, 240], recommended: [760, 500], capacity: "Start with three short columns. The table body can scroll." },
    controls: { minimum: [300, 160], recommended: [540, 270], capacity: "Up to two short button labels. Allow room for wrapping and a focus outline." }
  }
};

export function withComponentFitting(html) {
  if (!html.includes("</head>")) throw Error("unsupported runtime HTML head");
  const { padding, typography } = layoutContract;
  const clamp = ([min, max], preferred) => `clamp(${min}px,${preferred},${max}px)`;
  return html.replace("</head>", `<style>
    #world .node.card { container-type: size; }
    #world .card > .node-content {
      padding: ${clamp(padding.vertical, "9cqh")} ${clamp(padding.horizontal, "8cqw")};
      gap: ${clamp(padding.gap, "4cqh")};
    }
    #world .card .node-label { font-size: ${clamp(typography.label, "7cqh")}; }
    #world .card .node-title { font-size: ${clamp(typography.title, "13cqh")}; overflow-wrap: anywhere; }
    #world .card .node-text { font-size: ${clamp(typography.body, "9cqh")}; }
    #world .card .metric { font-size: ${clamp(typography.metric, "29cqh")}; overflow-wrap: anywhere; }
    #world .card .node-list { font-size: ${clamp(typography.list, "8cqh")}; overflow-wrap: anywhere; }
    #world .card .node-actions .btn { font-size: ${clamp(typography.button, "7cqh")}; }
  </style></head>`);
}
