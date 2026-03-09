(function () {
  var blocks = document.querySelectorAll(".prose pre");
  if (!blocks.length) return;

  blocks.forEach(function (pre) {
    if (pre.classList.contains("mermaid")) return;

    pre.style.position = "relative";

    var btn = document.createElement("button");
    btn.className = "code-copy-btn";
    btn.setAttribute("aria-label", "Copy code");
    btn.innerHTML = '<i class="ph ph-copy"></i>';

    btn.addEventListener("click", function () {
      var code = pre.querySelector("code");
      var text = code ? code.textContent : pre.textContent;
      navigator.clipboard.writeText(text).then(function () {
        btn.innerHTML = '<i class="ph ph-check"></i>';
        btn.classList.add("copied");
        setTimeout(function () {
          btn.innerHTML = '<i class="ph ph-copy"></i>';
          btn.classList.remove("copied");
        }, 2000);
      });
    });

    pre.appendChild(btn);
  });
})();
