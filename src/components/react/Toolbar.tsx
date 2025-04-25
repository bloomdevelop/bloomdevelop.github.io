import Comments from "./Comments";
import { PiChatCircleTextFill, PiArchiveFill } from "react-icons/pi";
import { motion } from "motion/react";
import { useState } from "react";
import ButtonIcon from "./ButtonIcon";

export default function Toolbar() {
  const [areCommentsOpen, setAreCommentsOpen] = useState(false);

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 50,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        type: "spring",
        stiffness: 100,
        damping: 20,
        duration: 0.3,
      }}
      className={`toolbar`}
    >
      {areCommentsOpen && (
        <Comments />
      )}
      <div className="toolbar-items">
        <a
          href="https://github.com/bloomdevelop/bloomdevelop.github.io"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ButtonIcon tooltip="View Repository">
            <PiArchiveFill />
          </ButtonIcon>
        </a>
        <ButtonIcon
          tooltip={areCommentsOpen ? "Hide Comments" : "Show Comments"}
          onClick={() => setAreCommentsOpen((open) => !open)}
        >
          <PiChatCircleTextFill />
        </ButtonIcon>
      </div>
    </motion.div>
  );
}
