import { motion } from "motion/react";
import { useState } from "react";
import ButtonIcon from "./ButtonIcon";
import { PiArchiveFill } from "react-icons/pi";
import Comments from "./Comments";

export default function Toolbar() {
  const [status, setStatus] = useState<"expanded" | "collapsed">("collapsed");
  const [isInteracting, setIsInteracting] = useState(false);
  const [areCommentsOpen, setAreCommentsOpen] = useState(false);

  return (
    <motion.div
      animate={status}
      variants={{
        expanded: {
          scale: 1,
          opacity: 1,
          bottom: 20,
        },
        collapsed: {
          scale: 0.8,
          opacity: 0.4,
          bottom: 5,
        },
      }}
      onHoverStart={() => {
        if (!isInteracting) setStatus("expanded");
      }}
      onHoverEnd={() => {
        if (!isInteracting && !areCommentsOpen) {
          setTimeout(() => setStatus("collapsed"), 1000);
        }
      }}
      transition={{
        type: "spring",
        bounce: 0.5,
      }}
      className="toolbar"
    >
      <Comments
        onInteractionChange={setIsInteracting}
        onCommentsOpenChange={setAreCommentsOpen}
      />
      <a href="https://github.com/bloomdevelop/bloomdevelop.github.io" target="_blank" rel="noopener noreferrer">
        <ButtonIcon tooltip="View Repository">
          <PiArchiveFill />
        </ButtonIcon>
      </a>
    </motion.div>
  );
}
