import { PiChatCircleFill, PiArrowsInSimpleFill } from "react-icons/pi";
import ButtonIcon from "./ButtonIcon";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { Suspense, useEffect, useState } from "react";
import type { AddCommentType, CommentsType } from "../../types";
import { supabase } from "../../lib/supabase";
import { useForm, type SubmitHandler } from "@modular-forms/react";
import { TextInput } from "./CustomInput";

type CommentsProps = {
  onInteractionChange: (isInteracting: boolean) => void;
  onCommentsOpenChange: (areCommentsOpen: boolean) => void;
};

export default function Comments({ onInteractionChange, onCommentsOpenChange }: CommentsProps) {
  const [, { Form, Field }] = useForm<AddCommentType>();
  const [comments, setComments] = useState<CommentsType[] | null | undefined>(
    []
  );

  useEffect(() => {
    const fetchAllComments = async () => {
      const { data } = await supabase
        .from("comments")
        .select("*")
        .order("created_at", { ascending: false });
      setComments(data || []);
    };
    fetchAllComments();
  }, []);

  const handleSubmit: SubmitHandler<AddCommentType> = (values, event) => {
    // Your code here
  };

  return (
    <AnimatePresence>
      <Popover.Root
        onOpenChange={(open) => onCommentsOpenChange(open)}
      >
        <Popover.Trigger disabled>
          <ButtonIcon disabled tooltip="View Comments (Coming Soon)">
            <PiChatCircleFill />
          </ButtonIcon>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={15}
            asChild
          >
            <div
              className="comments_container">
              <div className="flex flex-row justify-between items-center gap-20">
                <h1 className="font-clash-display text-3xl font-bold">
                  Comments
                </h1>
                <Popover.Close className="flex justify-center items-center p-2 bg-background-600 rounded-full">
                  <PiArrowsInSimpleFill />
                </Popover.Close>
              </div>
              <div className="flex flex-row items-center gap-2 mt-4">
                <Form
                  className="w-full flex flex-col gap-4"
                  onSubmit={handleSubmit}
                  onFocus={() => onInteractionChange(true)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      onInteractionChange(false);
                    }
                  }}
                >
                  <Field name="username">
                    {(field, props) => (
                      <TextInput
                        type="text"
                        label="Username"
                        value={field.value}
                        error={field.error}
                        {...props}
                        required
                      />
                    )}
                  </Field>
                  <Field name="content">
                    {(field, props) => (
                      <TextInput
                        type="text"
                        label="Write your comment"
                        value={field.value}
                        error={field.error}
                        {...props}
                        required
                      />
                    )}
                  </Field>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-primary-500 text-text-900 font-semibold hover:bg-primary-600 transition"
                  >
                    Submit
                  </button>
                </Form>
              </div>
              <div className="my-4">
                <Suspense fallback={<p>Loading...</p>}>
                  {comments && comments.length > 0 ? (
                    comments.map((comment) => (
                      <div key={comment.id ?? comment.created_at?.toString()}>
                        <p className="font-semibold">
                          {comment.username ?? "Anonymous"}
                        </p>
                        <p>{comment.content}</p>
                      </div>
                    ))
                  ) : (
                    <p>No Comments Yet!</p>
                  )}
                </Suspense>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </AnimatePresence>
  );
}
