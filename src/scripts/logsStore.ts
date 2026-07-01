import { type Ref, ref } from "vue";

export const logs: Ref<any[]> = ref([]);

export function prependLog(entry: {
  rkey: string;
  content: string;
  createdAt: string;
}) {
  logs.value.unshift(entry);
}
