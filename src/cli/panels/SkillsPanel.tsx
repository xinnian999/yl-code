import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Agent } from "@/core/agent/Agent.ts";
import type { SkillIndexEntry } from "@/core/skills/index.ts";
import { openFileInEditor } from "@/core/editor-detector.ts";
import {
  clampSelectedIndex,
  getNextSelectedIndex,
} from "./list-helpers.ts";
import SelectableList from "./SelectableList.tsx";
import { buildSkillLabel } from "./skills-panel-helpers.ts";

/** Skills 面板属性 */
export interface SkillsPanelProps {
  /** Agent 实例 */
  agent: Agent;
  /** 关闭回调 */
  onClose: () => void;
}

/** Skills 面板 */
const SkillsPanel: React.FC<SkillsPanelProps> = ({ agent, onClose }) => {
  const [skills, setSkills] = useState<SkillIndexEntry[]>(() => {
    return agent.getSkills();
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const items = useMemo(() => {
    return skills.map((skill) => ({
      id: skill.name,
      label: buildSkillLabel(skill),
    }));
  }, [skills]);

  useEffect(() => {
    /** 同步技能列表 */
    const handleSkillsChange = () => {
      setSkills(agent.getSkills());
    };

    agent.skillManager.on("skills:change", handleSkillsChange);
    return () => {
      agent.skillManager.off("skills:change", handleSkillsChange);
    };
  }, [agent]);

  useEffect(() => {
    setSelectedIndex((currentIndex) => {
      return clampSelectedIndex(currentIndex, skills.length);
    });
  }, [skills.length]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((currentIndex) => {
        return getNextSelectedIndex(currentIndex, skills.length, "up");
      });
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((currentIndex) => {
        return getNextSelectedIndex(currentIndex, skills.length, "down");
      });
      return;
    }

    const selectedSkill = skills[selectedIndex];
    if (!selectedSkill) {
      return;
    }

    if (input.toLowerCase() === "t") {
      const enabled = agent.toggleSkill(selectedSkill.name);
      setStatusMessage(`${selectedSkill.name} 已${enabled ? "启用" : "禁用"}`);
      return;
    }

    if (input.toLowerCase() === "r") {
      agent.reloadSkills();
      setStatusMessage("技能列表已刷新");
      return;
    }

    if (input.toLowerCase() !== "o") {
      return;
    }

    const editorName = openFileInEditor(selectedSkill.skillFilePath);
    if (editorName) {
      setStatusMessage(`已在 ${editorName} 中打开 ${selectedSkill.name}`);
      return;
    }

    setStatusMessage(`技能文件路径: ${selectedSkill.skillFilePath}`);
  });

  return (
    <SelectableList
      title="🧩 Skills 管理 (↑↓ 移动, Esc 返回)"
      items={items}
      selectedIndex={selectedIndex}
      emptyText="暂无 Skills"
      footer={
        <Box flexDirection="column">
          {statusMessage ? (
            <Box marginBottom={1}>
              <Text color="yellow">{statusMessage}</Text>
            </Box>
          ) : null}
          {skills[selectedIndex] ? (
            <Box marginBottom={1} flexDirection="column">
              <Text dimColor>{skills[selectedIndex].description}</Text>
            </Box>
          ) : null}
          <Text dimColor>
            <Text color="cyan">t</Text> 启用/禁用 |{" "}
            <Text color="cyan">o</Text> 打开技能文件 |{" "}
            <Text color="cyan">r</Text> 刷新
          </Text>
        </Box>
      }
    />
  );
};

export default SkillsPanel;
