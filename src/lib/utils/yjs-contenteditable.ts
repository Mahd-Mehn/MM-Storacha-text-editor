import type { Text as YText } from 'yjs';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getCaretOffsetWithin(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return 0;

  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  return preCaretRange.toString().length;
}

export function setCaretOffsetWithin(element: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (!selection) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

  let currentNode = walker.nextNode() as Text | null;
  let remaining = offset;

  while (currentNode) {
    const length = currentNode.nodeValue?.length ?? 0;
    if (remaining <= length) break;
    remaining -= length;
    currentNode = walker.nextNode() as Text | null;
  }

  const range = document.createRange();
  if (currentNode) {
    const length = currentNode.nodeValue?.length ?? 0;
    range.setStart(currentNode, clamp(remaining, 0, length));
  } else {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function setInnerTextPreserveCaret(element: HTMLElement, nextText: string): void {
  const isFocused = document.activeElement === element;
  const caretOffset = isFocused ? getCaretOffsetWithin(element) : 0;

  element.innerText = nextText;

  if (isFocused) {
    setCaretOffsetWithin(element, clamp(caretOffset, 0, nextText.length));
  }
}

export function ensureYTextSeededFromPlainText(ytext: YText, initialText: string): void {
  if (!initialText) return;
  if (ytext.length !== 0) return;

  ytext.insert(0, initialText);
}

export function overwriteYText(ytext: YText, nextText: string): void {
  const current = ytext.toString();
  if (current === nextText) return;

  ytext.delete(0, ytext.length);
  if (nextText) {
    ytext.insert(0, nextText);
  }
}
