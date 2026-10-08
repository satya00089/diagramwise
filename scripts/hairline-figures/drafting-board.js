hairline({
  name: "drafting-board",
  means: "The first component moves from the palette into an otherwise empty workspace.",
  rules: [1, 3, 5, 7, 8, 9],
  range: [25, 45, 65],
  mount: (host, value) => mountScene(host, value, "canvas"),
});
