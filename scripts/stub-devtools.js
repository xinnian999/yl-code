// Stub for Node CLI: react-devtools-core 依赖浏览器 self，在 Node 下会报错。
// ink 仅在 DEV=true 时使用，这里提供空实现即可。
export default {
  initialize() {},
  connectToDevTools() {},
};
