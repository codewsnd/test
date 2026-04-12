export const readClipboard = async (): Promise<string> => {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText();
    } else {
      const textarea = document.createElement('textarea');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.value = '';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const result = document.execCommand('paste');
      document.body.removeChild(textarea);

      if (result) {
        return textarea.value;
      } else {
        throw new Error('cannot read clipboard');
      }
    }
  } catch (err) {
    throw new Error('Cannot read clipboard:');
  }
};
