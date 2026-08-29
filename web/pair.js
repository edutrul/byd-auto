(() => {
  const pairId = location.hash.slice(1);
  const token = document.querySelector("#token");
  const status = document.querySelector("#status");
  const button = document.querySelector("#pair");
  if (!pairId) {
    status.textContent = "No pairing code found. Start again on the BYD console.";
    button.disabled = true;
  }
  document.querySelector("#pair-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = "Pairing…";
    status.classList.remove("error");
    try {
      const response = await fetch("/pair/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairId, token: token.value })
      });
      token.value = "";
      if (!response.ok) throw new Error(await response.text());
      status.textContent = "Paired. Return to the BYD console.";
    } catch (error) {
      status.textContent = error.message || "Pairing failed.";
      status.classList.add("error");
      button.disabled = false;
    }
  });
})();
