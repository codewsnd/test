import { useState } from 'react';
import * as diff from 'diff';
import '../App.css';

interface DiffPart {
  added?: boolean;
  removed?: boolean;
  value: string;
}

const StringDiffViewer = () => {
  const [text1, setText1] = useState('Hello, this is a test string');
  const [text2, setText2] = useState('Hello, this is a different string');
  const [caseSensitive, setCaseSensitive] = useState(false);

  // 比较两个字符串并返回高亮显示的组件
  const getHighlightedDiff = () => {
    const str1 = caseSensitive ? text1 : text1.toLowerCase();
    const str2 = caseSensitive ? text2 : text2.toLowerCase();

    const differences = diff.diffChars(str1, str2) as DiffPart[];

    return differences.map((part: DiffPart, index: number) => {
      let color = 'black';
      let backgroundColor = 'transparent';
      let textDecoration = 'none';

      if (part.added) {
        color = 'green';
        backgroundColor = '#e8f5e8';
        textDecoration = 'underline';
      } else if (part.removed) {
        color = 'red';
        backgroundColor = '#ffe8e8';
        textDecoration = 'line-through';
      } else {
        color = 'green';
        backgroundColor = '#f0f9f0';
      }

      return (
        <span
          key={index}
          style={{
            color,
            backgroundColor,
            padding: '2px 1px',
            margin: '0 1px',
            borderRadius: '2px',
            textDecoration
          }}
        >
          {part.value}
        </span>
      );
    });
  };

  // 分别高亮显示两个字符串
  const getSeparateHighlights = () => {
    const str1 = caseSensitive ? text1 : text1.toLowerCase();
    const str2 = caseSensitive ? text2 : text2.toLowerCase();

    const differences = diff.diffChars(str1, str2) as DiffPart[];

    let index1 = 0;
    let index2 = 0;

    const result1: JSX.Element[] = [];
    const result2: JSX.Element[] = [];

    differences.forEach((part: DiffPart, idx: number) => {
      if (part.removed) {
        // 只在第一个字符串中显示
        result1.push(
          <span
            key={`1-${idx}`}
            style={{
              color: 'red',
              backgroundColor: '#ffe8e8',
              padding: '2px 1px',
              margin: '0 1px',
              borderRadius: '2px',
              textDecoration: 'line-through'
            }}
          >
            {text1.substring(index1, index1 + part.value.length)}
          </span>
        );
        index1 += part.value.length;
      } else if (part.added) {
        // 只在第二个字符串中显示
        result2.push(
          <span
            key={`2-${idx}`}
            style={{
              color: 'blue',
              backgroundColor: '#e8f0ff',
              padding: '2px 1px',
              margin: '0 1px',
              borderRadius: '2px'
            }}
          >
            {text2.substring(index2, index2 + part.value.length)}
          </span>
        );
        index2 += part.value.length;
      } else {
        // 两个字符串中相同的部分
        result1.push(
          <span
            key={`1-${idx}`}
            style={{
              color: 'green',
              backgroundColor: '#f0f9f0',
              padding: '2px 1px',
              margin: '0 1px',
              borderRadius: '2px'
            }}
          >
            {text1.substring(index1, index1 + part.value.length)}
          </span>
        );

        result2.push(
          <span
            key={`2-${idx}`}
            style={{
              color: 'green',
              backgroundColor: '#f0f9f0',
              padding: '2px 1px',
              margin: '0 1px',
              borderRadius: '2px'
            }}
          >
            {text2.substring(index2, index2 + part.value.length)}
          </span>
        );

        index1 += part.value.length;
        index2 += part.value.length;
      }
    });

    return { result1, result2 };
  };

  const { result1, result2 } = getSeparateHighlights();
  const combinedResult = getHighlightedDiff();

  return (
    <div className="app">
      <h1>字符串匹配比较工具</h1>
      <p>输入两个字符串，查看它们之间的差异。相同部分显示为绿色，不同部分分别用红色和蓝色高亮。</p>

      <div className="controls">
        <div className="checkbox-container">
          <input
            type="checkbox"
            id="caseSensitive"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          <label htmlFor="caseSensitive">区分大小写</label>
        </div>
      </div>

      <div className="input-section">
        <div className="input-group">
          <label>字符串 1:</label>
          <textarea
            value={text1}
            onChange={(e) => setText1(e.target.value)}
            rows={3}
            placeholder="输入第一个字符串"
          />
        </div>

        <div className="input-group">
          <label>字符串 2:</label>
          <textarea
            value={text2}
            onChange={(e) => setText2(e.target.value)}
            rows={3}
            placeholder="输入第二个字符串"
          />
        </div>
      </div>

      <div className="result-section">
        <h2>比较结果</h2>

        <div className="result-type">
          <h3>合并显示差异</h3>
          <div className="diff-result combined">
            {combinedResult}
          </div>
          <div className="legend">
            <div className="legend-item">
              <span className="color-box same"></span>
              <span>相同部分</span>
            </div>
            <div className="legend-item">
              <span className="color-box removed"></span>
              <span>仅在字符串1中（删除）</span>
            </div>
            <div className="legend-item">
              <span className="color-box added"></span>
              <span>仅在字符串2中（添加）</span>
            </div>
          </div>
        </div>

        <div className="result-type">
          <h3>分别显示</h3>
          <div className="diff-result separate">
            <div className="string-display">
              <strong>字符串 1:</strong> {result1}
            </div>
            <div className="string-display">
              <strong>字符串 2:</strong> {result2}
            </div>
          </div>
          <div className="legend">
            <div className="legend-item">
              <span className="color-box same"></span>
              <span>相同部分</span>
            </div>
            <div className="legend-item">
              <span className="color-box removed"></span>
              <span>仅在字符串1中</span>
            </div>
            <div className="legend-item">
              <span className="color-box added"></span>
              <span>仅在字符串2中</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StringDiffViewer;
