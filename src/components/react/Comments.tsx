import { PiChatCircleFill, PiArrowsInSimpleFill } from "react-icons/pi";
import ButtonIcon from "./ButtonIcon";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";

export default function Comments() {

    return <AnimatePresence>
        <Popover.Root>
            <Popover.Trigger>
                <ButtonIcon tooltip="View Comments">
                    <PiChatCircleFill />
                </ButtonIcon>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content sideOffset={15}>
                    <motion.div
                        className="comments_container"
                        initial={{
                            opacity: 0,
                            transform: "translateY(20px)"
                        }}
                        animate={{
                            opacity: 1,
                            transform: "translateY(0px)"
                        }}
                        transition={{
                            duration: 0.3
                        }}>
                        <div className="flex flex-row justify-between items-center gap-20">
                            <h1 className="font-clash-display text-3xl font-bold">Comments</h1>
                            <Popover.Close className="flex justify-center items-center p-2 bg-background-600 rounded-full">
                                <PiArrowsInSimpleFill />
                            </Popover.Close>
                        </div>
                        <div className="flex flex-row items-center gap-2 mt-4">
                            <input
                                className="flex-1 px-3 py-2 rounded-lg bg-background-200 text-text-900 placeholder:text-background-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                                placeholder="Add a comment..."
                                type="text"
                            />
                            <button className="px-4 py-2 rounded-lg bg-primary-500 text-text-900 font-semibold hover:bg-primary-600 transition">
                                Submit
                            </button>
                        </div>
                        <div className="my-4">
                            <p>No Comments Yet!</p>
                        </div>
                    </motion.div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root >
    </AnimatePresence>
}