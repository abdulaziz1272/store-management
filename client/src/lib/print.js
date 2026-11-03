// Printing helper.
//
// The browser prints the page. We add a temporary @page rule so that the paper size
// is right (for example 40mm x 30mm for stickers), then call window.print().

export function printWithPageSize(pageSizeRule) {
  const style = document.createElement('style');
  style.textContent = '@page { ' + pageSizeRule + ' margin: 0; }';
  document.head.appendChild(style);

  function cleanUp() {
    style.remove();
    window.removeEventListener('afterprint', cleanUp);
  }

  window.addEventListener('afterprint', cleanUp);
  window.print();
}
