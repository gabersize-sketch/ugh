/*
  Texting Block Lite
  Registers a new "texting-block" element for inline use within Guinevere scenes.
  Does not modify or observe chat messages.
*/

(() => {
  console.log("[Texting Block Lite] Loaded — inline texting layout is available.");

  // Optional: ensure styling is loaded only once
  if (!document.getElementById("texting-block-lite-style")) {
    const link = document.createElement("link");
    link.id = "texting-block-lite-style";
    link.rel = "stylesheet";
    link.href = "style.css";
    document.head.appendChild(link);
  }
})();
