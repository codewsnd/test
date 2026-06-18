import http from 'node:http';

const PORT = 8081;

const imageA = {
  base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  fileName: 'screen-a.png',
  md5: 'image-a',
};

const imageB = {
  base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  fileName: 'screen-b.png',
  md5: 'image-b',
};

const noteImage = {
  base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  fileName: 'manual-note.png',
  md5: 'manual-note',
};

const initialStorage = `
<table>
  <tr>
    <th>Label</th>
    <th>Comparison|values=en|</th>
    <th>Reference|values=en|</th>
    <th>Test Result - Comparison|values=en|</th>
    <th>Test Evidence - Comparison|values=en|</th>
    <th>Test Result - Reference|values=en|</th>
    <th>Test Evidence - Reference|values=en|</th>
  </tr>
  <tr>
    <td>Row 1</td>
    <td>Hello Copy</td>
    <td>Hello Reference</td>
    <td data-copy-test-column-type="result" data-copy-test-source-column-key="1:Comparison|values=en|">
      <p>USER_RESULT_NOTE_A_KEEP</p>
      <strong>Failed:</strong>
      <ul>
        <li>Screen 01<ul><li>Initial failure A</li></ul></li>
      </ul>
      <ul><li>USER_RESULT_LIST_A_KEEP</li></ul>
    </td>
    <td data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Comparison|values=en|">
      <p>USER_EVIDENCE_NOTE_A_KEEP</p>
      <div>
        <strong>Screen 01</strong>
        <br />
        <ac:image>
          <ri:attachment ri:filename="screen-a.png" />
        </ac:image>
      </div>
      <div>
        <strong>User attachment should not be evidence</strong>
        <ac:image>
          <ri:attachment ri:filename="manual-note.png" />
        </ac:image>
      </div>
    </td>
    <td data-copy-test-column-type="result" data-copy-test-source-column-key="2:Reference|values=en|">
      <p>USER_RESULT_NOTE_B_KEEP</p>
      <strong>Passed:</strong>
      <ul>
        <li>Screen 01</li>
      </ul>
    </td>
    <td data-copy-test-column-type="evidence" data-copy-test-source-column-key="2:Reference|values=en|">
      <p>USER_EVIDENCE_NOTE_B_KEEP</p>
      <div>
        <strong>Screen 01</strong>
        <br />
        <ac:image>
          <ri:attachment ri:filename="screen-b.png" />
        </ac:image>
      </div>
    </td>
  </tr>
</table>`;

let currentStorage = initialStorage;
const uploadBodies = [];
const storageRequests = [];

const sendJson = (res, payload) => {
  res.writeHead(200, {
    'Access-Control-Allow-Headers': 'Content-Type, uid, X-E2E-Trust-Token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(payload));
};

const readBody = req => new Promise(resolve => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8');
    resolve(text ? JSON.parse(text) : {});
  });
});

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, {});
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/api/chatbycard/copydeck/storage') {
    storageRequests.push(Object.fromEntries(url.searchParams.entries()));
    sendJson(res, { confluenceTitle: 'CopyTest Browser Mock', storage: currentStorage });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/chatbycard/copydeck/getAttachments') {
    const body = await readBody(req);
    const fileNames = new Set(body.fileNames || []);
    sendJson(res, { images: [imageA, imageB, noteImage].filter(image => fileNames.has(image.fileName)) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/chatbycard/copydeck/upload') {
    const body = await readBody(req);
    uploadBodies.push(body);
    currentStorage = body.storageHtml;
    sendJson(res, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/__copytest_mock_state') {
    sendJson(res, { currentStorage, storageRequests, uploadBodies });
    return;
  }

  res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`copytest browser mock listening on ${PORT}`);
});
