# 项目踩坑记录

## Ink + ink-text-input 光标错乱问题

### 问题描述
使用 `ink-text-input` 组件时，长按退格键会导致光标乱飞、字符无法正常删除。

### 解决方案
**不要在 Box 组件上使用 `backgroundColor` 属性。**

```tsx
// ❌ 会导致光标错乱
<Box backgroundColor="#333333">

// ✅ 注释掉就好了
<Box>
```

