import chalk from "chalk";

const ai = (message) => {
  console.log(chalk.green(`${message}\n`));
};

const toolCall = (message) => {
  console.log(chalk.blueBright(`🔨 ${message}\n`));
};

const error = (message) => {
  console.log(chalk.redBright(`${message}\n`));
};

const warning = (message) => {
  console.log(chalk.yellowBright(`${message}\n`));
};

/**
 * 显示 loading 动画的工具函数
 * @param {string} message - 要显示的消息文本
 * @param {number} interval - 动画更新间隔（毫秒），默认 100ms
 * @returns {Object} 包含 start 和 stop 方法的对象
 */
const createLoadingLog = (message = "加载中...", interval = 100) => {
  const loadingChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let loadingIndex = 0;
  let loadingInterval = null;
  let isRunning = false;

  return {
    start() {
      if (isRunning) return;
      
      isRunning = true;

      loadingInterval = setInterval(() => {
        process.stdout.write(
          chalk.gray(`\r${loadingChars[loadingIndex]} ${message}`)
        );
        loadingIndex = (loadingIndex + 1) % loadingChars.length;
      }, interval);
    },

    /**
     * 停止 loading 动画并清除
     */
    stop() {
      if (!isRunning) return;
      isRunning = false;

      if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
      }
      process.stdout.write(`\r\x1b[K`);
    },
  };
};

/**
 * 包装异步函数，自动显示 loading 动画
 * @param {Object} options - 配置对象
 * @param {Promise} options.promise - 要执行的异步操作
 * @param {string} [options.message="加载中..."] - loading 消息文本
 * @param {number} [options.interval=100] - 动画更新间隔（毫秒），默认 100ms
 * @param {boolean} [options.newLine=true] - 是否在新行显示，默认 true
 * @returns {Promise} 返回原始 Promise
 */
const withLoading = async ({
  promise,
  message = "加载中...",
  interval = 100,
}) => {
  const loading = createLoadingLog(message, interval);

  loading.start();

  try {
    const result = await promise;
    loading.stop();

    return result;
  } catch (error) {
    loading.stop();

    throw error;
  }
};

export default {
  ai,
  toolCall,
  error,
  warning,
  withLoading,
};

