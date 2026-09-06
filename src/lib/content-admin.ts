import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { deleteContent } from "@/lib/draw-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

/** 发起人删除历史(投票/抽签);删完刷新全部列表与首页。 */
export function useDeleteContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (contentId: string) => deleteContent({ data: { contentId } }),
    onSettled: () => {
      void queryClient.invalidateQueries();
      void router.invalidate();
    },
  });
}

/** 该登录者是否可删这行(发起人本人;无主历史登录者可清理)。 */
export function useCanDelete() {
  const { user } = useCurrentUserState();
  return (creatorId: string | null) =>
    Boolean(user) && (creatorId === null || creatorId === user!.id);
}
