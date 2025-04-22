import * as Tooltip from "@radix-ui/react-tooltip";
import type { JSX, ReactNode } from "react";
import { motion } from "motion/react";

interface ButtonIcon {
    children: ReactNode | JSX.Element,
    tooltip: string,
    onClick?: () => void,
}

export default function ButtonIcon(props: ButtonIcon) {
    return <Tooltip.Provider>
        <Tooltip.Root>
            <Tooltip.Trigger>
                <button onClick={props.onClick} className="button-icon">
                    {props.children}
                </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content sideOffset={10}>
                    <motion.div
                        className="tooltip"
                        initial={{
                            opacity: 0,
                            scale: 0.5
                        }}
                        animate={{
                            opacity: 1,
                            scale: 1
                        }}
                    >
                        {props.tooltip}
                    </motion.div>
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    </Tooltip.Provider>
}