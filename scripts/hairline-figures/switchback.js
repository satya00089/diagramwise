hairline({
  name: "switchback",
  means: "Four lessons share a path; the selected lesson opens and its neighbours respond.",
  rules: [1, 3, 5, 7, 8, 9],
  range: [25, 45, 65],
  mount: (host, value) => mountScene(host, value, "learn"),
});
