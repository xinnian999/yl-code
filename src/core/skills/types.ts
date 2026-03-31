/** 技能来源类型 */
export type SkillSourceKind =
  | "workspace_agents"
  | "workspace_local"
  | "user"
  | "bundled";

/** 技能锁文件条目 */
export interface SkillLockEntry {
  /** 技能来源标识 */
  source: string;
  /** 技能来源类型 */
  sourceType: string;
  /** 技能内容哈希 */
  computedHash: string;
}

/** 技能锁文件结构 */
export interface SkillsLockFile {
  /** 锁文件版本 */
  version: number;
  /** 技能条目映射 */
  skills: Record<string, SkillLockEntry>;
}

/** 技能 frontmatter 解析结果 */
export interface ParsedSkillDocument {
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 技能别名 */
  aliases: string[];
  /** 技能正文 */
  content: string;
}

/** 技能清单 */
export interface SkillManifest {
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 技能别名 */
  aliases: string[];
  /** 技能正文 */
  content: string;
  /** 技能目录路径 */
  directoryPath: string;
  /** 技能文件路径 */
  skillFilePath: string;
  /** 技能来源类型 */
  sourceKind: SkillSourceKind;
  /** 是否为只读技能 */
  readonly: boolean;
  /** 是否启用 */
  enabled: boolean;
  /** 绑定的锁文件来源信息 */
  lockEntry: SkillLockEntry | null;
}

/** 技能索引项 */
export interface SkillIndexEntry {
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 技能别名 */
  aliases: string[];
  /** 技能目录路径 */
  directoryPath: string;
  /** 技能文件路径 */
  skillFilePath: string;
  /** 技能来源类型 */
  sourceKind: SkillSourceKind;
  /** 是否为只读技能 */
  readonly: boolean;
  /** 是否启用 */
  enabled: boolean;
  /** 绑定的锁文件来源信息 */
  lockEntry: SkillLockEntry | null;
}

/** 技能状态快照 */
export interface SkillStateSnapshot {
  /** 全局技能开关 */
  global: Record<string, boolean>;
  /** 工作区技能开关 */
  workspaces: Record<string, Record<string, boolean>>;
}

/** 技能工具载荷 */
export interface SkillToolPayload {
  /** 需要读取正文的技能名称列表 */
  skillNames: string[];
}

/** 技能来源配置 */
export interface SkillSourceConfig {
  /** 技能来源类型 */
  kind: SkillSourceKind;
  /** 技能根目录 */
  directoryPath: string;
  /** 是否为只读来源 */
  readonly: boolean;
}
