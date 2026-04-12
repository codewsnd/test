import type { ConversationHistory } from '../api/conversationHistoryApi';
import type { ConversationState, ConversationTurn } from '../pages/home/components/chat/types';

/**
 * Mock数据生成器
 * 用于生成测试用的会话数据
 */

// 会话标题模板
const conversationTitles = [
  "如何学习React编程？",
  "什么是TypeScript的优势？",
  "前端开发最佳实践",
  "JavaScript异步编程详解",
  "Vue和React的区别是什么？",
  "如何优化网站性能？",
  "什么是响应式设计？",
  "Node.js后端开发指南",
  "数据库设计原则",
  "如何使用Git进行版本控制？",
  "CSS动画效果实现",
  "移动端开发注意事项",
  "API接口设计规范",
  "前端安全最佳实践",
  "Webpack配置详解",
  "如何进行代码重构？",
  "软件测试策略",
  "敏捷开发方法论",
  "云服务部署指南",
  "数据可视化技术",
  "人工智能基础概念",
  "机器学习入门指南",
  "深度学习框架对比",
  "区块链技术原理",
  "网络安全防护措施",
  "设计模式应用实例",
  "算法与数据结构",
  "系统架构设计思路",
  "微服务架构实践",
  "容器化技术应用",
  // 去年的数据可以使用一些较旧的技本话题
  "jQuery如何实现动画效果？",
  "Bootstrap响应式布局指南",
  "AngularJS入门教程",
  "PHP和MySQL开发基础",
  "Java Spring框架学习",
  "Python Django开发实践",
  "C#和.NET平台开发",
  "Ruby on Rails框架介绍",
  "Objective-C iOS开发",
  "Android原生Java开发",
  "Flash动画制作技巧",
  "Photoshop图片处理技巧",
  "SEO搜索引擎优化",
  "WordPress网站搭建",
  "Drupal CMS使用指南",
  "Apache服务器配置",
  "Nginx反向代理设置",
  "Linux系统管理基础",
  "Windows Server部署指南",
  "Oracle数据库优化",
  "SQL Server数据库设计"
];

// 用户消息模板
const userMessages = [
  "能详细解释一下这个概念吗？",
  "有什么实际的应用案例吗？",
  "这种方法的优缺点是什么？",
  "如何在项目中实际应用？",
  "有推荐的学习资源吗？",
  "这个技术的发展前景如何？",
  "与其他类似技术相比有什么优势？",
  "实现过程中需要注意什么？",
  "有没有更简单的替代方案？",
  "如何解决常见的问题？"
];

// AI回复消息模板
const botMessages = [
  "这是一个很好的问题。让我来详细解释一下...",
  "根据我的理解，这个概念主要包含以下几个方面...",
  "在实际应用中，我们通常会考虑以下因素...",
  "这种技术确实有很多优势，主要体现在...",
  "关于学习资源，我推荐以下几个方向...",
  "从技术发展趋势来看...",
  "相比其他技术，它的主要优势在于...",
  "在实现过程中，需要特别注意...",
  "确实有一些替代方案，比如...",
  "常见问题的解决方法通常包括..."
];

/**
 * 生成指定时间范围内的时间戳
 */
function generateTimestamp(daysAgo: number, variance: number = 0): number {
  const now = Date.now();
  const baseDaysAgo = daysAgo + (Math.random() * variance - variance / 2);
  return now - (baseDaysAgo * 24 * 60 * 60 * 1000);
}

/**
 * 生成ConversationTurn数组
 */
function generateConversationTurns(turnCount: number, baseTimestamp: number, conversationId: string): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  for (let i = 0; i < turnCount; i++) {
    const turnId = `${conversationId}_turn_${i}_${Date.now()}`;
    const userContent = userMessages[Math.floor(Math.random() * userMessages.length)];
    const aiContent = botMessages[Math.floor(Math.random() * botMessages.length)];

    const turn: ConversationTurn = {
      id: turnId,
      turnIndex: i,
      timestamp: new Date(baseTimestamp + i * 2000), // 每个轮次间隔2秒
      userInput: {
        content: userContent
      },
      aiResponse: {
        content: aiContent,
        status: 'completed',
        timestamp: new Date(baseTimestamp + i * 2000 + 1000) // AI回复延迟1秒
      }
    };

    turns.push(turn);
  }

  return turns;
}

/**
 * 生成单个会话数据
 */
function generateConversation(
  id: string,
  timestamp: number,
  isPinned: boolean = false,
  isStarred: boolean = false
): ConversationHistory {
  const title = conversationTitles[Math.floor(Math.random() * conversationTitles.length)];
  const turnCount = Math.floor(Math.random() * 3) + 1; // 1-3个轮次

  // 生成对话轮次
  const turns = generateConversationTurns(turnCount, timestamp, id);

  // 生成ConversationState
  const conversationState: ConversationState = {
    turns,
    currentTurnId: undefined // Mock数据默认没有正在进行的轮次
  };

  return {
    id,
    title,
    conversationState,
    isPinned,
    isStarred,
    createdAt: timestamp,
    updatedAt: timestamp + Math.floor(Math.random() * 3600000), // 更新时间稍晚一些
    chatId: `chat_${id}`
  };
}

/**
 * 生成Mock数据
 * @param todayCount 今天数据条数
 * @param yesterdayCount 昨天数据条数
 * @param thisWeekCount 本周数据条数
 * @param lastWeekCount 上周数据条数
 * @param earlierCount 更早数据条数
 * @param lastYearCount 去年数据条数
 * @returns 生成的会话数组
 */
export function generateMockConversations(
  todayCount: number = 5,
  yesterdayCount: number = 8,
  thisWeekCount: number = 10,
  lastWeekCount: number = 10,
  earlierCount: number = 10,
  lastYearCount: number = 20
): ConversationHistory[] {
  const conversations: ConversationHistory[] = [];
  let idCounter = 1;

  // 生成今天的数据
  for (let i = 0; i < todayCount; i++) {
    // 今天内的随机时间 (0-24小时前)
    const hoursAgo = Math.random() * 24;
    const timestamp = Date.now() - (hoursAgo * 60 * 60 * 1000);
    const isPinned = Math.random() < 0.15; // 15%概率置顶
    const isStarred = Math.random() < 0.25; // 25%概率收藏

    conversations.push(
      generateConversation(`mock_conv_${idCounter++}`, timestamp, isPinned, isStarred)
    );
  }

  // 生成昨天的数据
  for (let i = 0; i < yesterdayCount; i++) {
    // 昨天的随机时间 (24-48小时前)
    const timestamp = generateTimestamp(1, 0.5); // 昨天左右，差异0.5天
    const isPinned = Math.random() < 0.1; // 10%概率置顶
    const isStarred = Math.random() < 0.2; // 20%概率收藏

    conversations.push(
      generateConversation(`mock_conv_${idCounter++}`, timestamp, isPinned, isStarred)
    );
  }

  // 生成本周其他天数据 (2-7天前)
  for (let i = 0; i < thisWeekCount; i++) {
    const timestamp = generateTimestamp(2, 5); // 2-7天前
    const isStarred = Math.random() < 0.18; // 18%概率收藏

    conversations.push(
      generateConversation(`mock_conv_${idCounter++}`, timestamp, false, isStarred)
    );
  }

  // 生成更早数据 (15天以前)
  for (let i = 0; i < earlierCount; i++) {
    const timestamp = generateTimestamp(15, 30); // 15-45天前
    const isStarred = Math.random() < 0.1; // 10%概率收藏

    conversations.push(
      generateConversation(`mock_conv_${idCounter++}`, timestamp, false, isStarred)
    );
  }

  // 生成去年数据 (365天以前左右)
  for (let i = 0; i < lastYearCount; i++) {
    const timestamp = generateTimestamp(365, 100); // 365±50天前
    const isStarred = Math.random() < 0.05; // 5%概率收藏（较低，因为是去年的数据）

    conversations.push(
      generateConversation(`mock_conv_${idCounter++}`, timestamp, false, isStarred)
    );
  }

  // 按更新时间倒序排列
  return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 检查是否需要初始化Mock数据
 * @param existingCount 现有数据条数
 * @param minRequiredCount 最小所需数据条数
 * @returns 是否需要初始化
 */
export function shouldInitializeMockData(
  existingCount: number,
  minRequiredCount: number = 50
): boolean {
  return existingCount < minRequiredCount;
}

/**
 * 生成单个新会话（用于测试新建功能）
 */
export function generateNewConversation(): ConversationHistory {
  const now = Date.now();
  return generateConversation(`conv_${now}`, now);
}
