import { motion } from "motion/react";
import { useState } from "react";
import ButtonIcon from "./ButtonIcon";
import { PiArchiveFill } from "react-icons/pi";
import Comments from "./Comments";

export default function Toolbar() {
    const [status, setStatus] = useState<"expanded" | "collapsed">("collapsed");

    return <motion.div
        animate={status}
        variants={{
            expanded: {
                scale: 1,
                opacity: 1,
                bottom: 20
            },
            collapsed: {
                scale: 0.8,
                opacity: 0.4,
                bottom: 5
            }
        }}
        onHoverStart={() => setStatus('expanded')}
        onHoverEnd={() => {
            setTimeout(() => setStatus('collapsed'), 1000);
        }}
        transition={{
            type: "spring",
            bounce: 0.5
        }}
        className="toolbar"
    >
        <Comments />
        <ButtonIcon tooltip="View Repository">
            <PiArchiveFill />
        </ButtonIcon>
    </motion.div>
}