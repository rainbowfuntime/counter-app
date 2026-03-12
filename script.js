const addButton = document.getElementById('addButton');
const countText = document.getElementById('countText');

let count = 0;

addButton.addEventListener('click', () => {
  count += 1;
  countText.textContent = `Count: ${count}`;
});
