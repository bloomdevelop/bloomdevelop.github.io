import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AddCommentType } from "@/types";
import { useEffect } from "react";
import { motion, stagger } from "motion/react";

const Comments: React.FC = () => {
  const [username, setUsername] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [comments, setComments] = useState<
    { id: number; username: string; content: string; created_at: string }[]
  >([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    const newComment: AddCommentType = { username, content };
    const { error } = await supabase.from("comments").insert([newComment]);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setUsername("");
      setContent("");
    }
  };

  useEffect(() => {
    const fetchComments = async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, username, content, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        setFetchError(error.message);
      } else {
        setComments(data || []);
      }
    };
    fetchComments();
  }, [success]);

  return (
    <div className="comments_container">
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="flex-1 px-3 py-2 rounded-lg bg-background-200 text-text-900 placeholder:text-background-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
        />
        <textarea
          placeholder="Add a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          className="resize-none flex-1 px-3 py-2 rounded-lg bg-background-200 text-text-900 placeholder:text-background-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-2 bg-accent-700 rounded-lg text-white hover:bg-accent-800 transition duration-200 disabled:opacity-50"
        >
          {loading ? "Posting..." : "Post Comment"}
        </button>
        {error && <div className="text-red-500">{error}</div>}
        {success && (
          <div className="text-green-500 dark:text-green-400">
            Comment posted!
          </div>
        )}
      </form>
      {fetchError && <div className="text-red-500">{fetchError}</div>}
      <div className="mt-4 rounded-xl max-h-96 overflow-y-auto">
        <motion.ul className="space-y-4" transition={{staggerChildren: 0.5}}>
          {comments.map((comment) => (
            <motion.li
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              key={comment.id}
              className="bg-background-600 rounded-xl p-3"
            >
              <div className="text-xl font-semibold">{comment.username}</div>
              <div className="text-text-100">{comment.content}</div>
              <div className="text-xs opacity-50 text-text-50">
                {new Date(comment.created_at).toLocaleString()}
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </div>
  );
};

export default Comments;
