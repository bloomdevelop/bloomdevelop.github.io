import * as v from "valibot";

interface ILinks {
  title: string;
  url?: string;
  clipboard?: string;
}

const ProjectsSchema = v.object({
  title: v.string(),
  description: v.string(),
  link: v.optional(v.string()),
});

const CommentsSchema = v.object({
  id: v.optional(v.number()),
  created_at: v.optional(v.date()),
  username: v.string(),
  content: v.string()
})

const AddCommentSchema = v.object({
  username: v.string(),
  content: v.string()
})

export type LinksType = ILinks;
export type ProjectsType = v.InferInput<typeof ProjectsSchema>;
export type CommentsType = v.InferInput<typeof CommentsSchema>;
export type AddCommentType = v.InferInput<typeof AddCommentSchema>;
