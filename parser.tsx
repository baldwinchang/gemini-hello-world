export function renderLineBreaks(body: string, footnoteFn?: () => HTMLElement): HTMLElement {
  const bodySegments = body.split("\n");
  if (bodySegments.length == 0) {
    return null;
  }

  if (bodySegments.length == 1) {
    return renderLine(bodySegments[0]);
  }

  const responseNode = document.createElement('span');
  bodySegments.forEach((segment, idx) => {
    // first item may occur in-between text ranges
    let lineNode: HTMLElement;
    if (idx == 0) {
      lineNode = renderLine(segment);
    } else {

      if (idx > 1) {
        responseNode.appendChild(document.createElement('br'));
      }

      // each segment following is due to being interwoven by a line break
      lineNode = renderLine(segment, { node: 'span' });

      if (idx < bodySegments.length - 1) {
        lineNode.appendChild(document.createElement('br'));
      } else if (footnoteFn) {
        lineNode.appendChild(footnoteFn());
        lineNode.appendChild(document.createElement('br'));
      }
    }

    responseNode.appendChild(lineNode);

  });

  return responseNode;
}

export function renderLine(body: string, options?: { node: 'div' | 'span' }): HTMLElement {
  const elementType = options?.node ?? 'span';
  const responseNode = document.createElement(elementType);
  responseNode.textContent = body;
  return responseNode;
}