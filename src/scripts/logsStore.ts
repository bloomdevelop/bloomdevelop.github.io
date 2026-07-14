import { type Ref, ref } from "vue";

export const logs: Ref<any[]> = ref([]);

export function prependLog(entry: {
  rkey?: string;
  content: string;
  createdAt: string;
  isCrosspostEnabled: boolean
}) {
  logs.value.unshift(entry);
}
