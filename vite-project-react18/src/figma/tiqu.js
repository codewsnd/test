(async () => {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("❌ 请先在画布上选中一个你想转换的图层或画板！");
    return;
  }

  function rgbToHex(r, g, b) {
    const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  // 核心净化函数（升级为 async 异步，以支持图片导出）
  async function cleanNode(node) {
    if (!node || node.visible === false) return null;
    const cleaned = { name: node.name, type: node.type };

    // 1. 提取基础属性
    if (node.type === 'TEXT') cleaned.characters = node.characters;

    if (node.absoluteBoundingBox) {
      cleaned.width = Math.round(node.absoluteBoundingBox.width);
      cleaned.height = Math.round(node.absoluteBoundingBox.height);
      cleaned.x = Math.round(node.absoluteBoundingBox.x);
      cleaned.y = Math.round(node.absoluteBoundingBox.y);
    }

    if (node.layoutMode && node.layoutMode !== 'NONE') {
      cleaned.layoutMode = node.layoutMode;
      cleaned.primaryAxisAlignItems = node.primaryAxisAlignItems;
      cleaned.counterAxisAlignItems = node.counterAxisAlignItems;
      cleaned.itemSpacing = node.itemSpacing;
      cleaned.paddingLeft = node.paddingLeft;
      cleaned.paddingTop = node.paddingTop;
    }

    if (node.fills && Array.isArray(node.fills)) {
      cleaned.fills = node.fills
          .filter(f => f.type === 'SOLID' && f.visible !== false)
          .map(f => ({ type: 'SOLID', color: rgbToHex(f.color.r, f.color.g, f.color.b) }));
    }

    // ==========================================
    // 🌟 终极增强：本地无限制导出 SVG 和 图片
    // ==========================================

    // A. 拦截并导出 SVG
    const isIcon = node.name.toLowerCase().match(/icon|logo|svg/);
    const isVector = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'ELLIPSE'].includes(node.type);

    if (isIcon || isVector) {
      try {
        const svgBytes = await node.exportAsync({ format: 'SVG' });
        // 将 Uint8Array 转换为普通的 HTML SVG 字符串
        let svgString = '';
        for (let i = 0; i < svgBytes.length; i++) {
          svgString += String.fromCharCode(svgBytes[i]);
        }
        cleaned.svgContent = svgString; // 原生 SVG 代码！
        return cleaned; // 作为一个图标整体返回，不再深入解析子图层
      } catch (e) {
        console.error("SVG 导出失败: ", node.name);
      }
    }

    // B. 拦截并导出真实图片 (PNG 转 Base64)
    const hasImageFill = node.fills && Array.isArray(node.fills) && node.fills.some(f => f.type === 'IMAGE');
    const isPicName = node.name.toLowerCase().match(/img|image|pic|avatar|photo|bg|background/);

    if (hasImageFill || isPicName) {
      try {
        // 导出 2 倍图保证清晰度
        const pngBytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
        // 利用 Figma 原生方法转为 Base64
        const base64 = figma.base64Encode(pngBytes);
        cleaned.imageUrl = `data:image/png;base64,${base64}`; // 可以直接放进 <img src="..." /> 的数据！
        return cleaned; // 作为一个图片整体返回
      } catch (e) {
        console.error("图片导出失败: ", node.name);
      }
    }

    // ==========================================

    // 2. 递归处理子图层（因为加入了 await，必须用 for 循环）
    if (node.children) {
      cleaned.children = [];
      for (const child of node.children) {
        const childNode = await cleanNode(child);
        if (childNode) cleaned.children.push(childNode);
      }
    }

    return cleaned;
  }

  figma.notify("⏳ 正在全力渲染并提取图片和矢量数据，请稍候...");

  const finalData = selection.length === 1
      ? await cleanNode(selection[0])
      : await Promise.all(selection.map(cleanNode));

  console.log('%c [Figma to React JSON] 数据已包含图片与SVG 👇', 'color: #00C853; font-size: 16px; font-weight: bold;');
  console.log(finalData);

  figma.notify("✅ 提取成功！请按 F12 打开浏览器控制台复制 Object。");
})();
