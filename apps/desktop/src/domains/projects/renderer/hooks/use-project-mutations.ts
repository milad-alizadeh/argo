import { useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/platform/renderer/trpc-client'

export function useProjectMutations() {
  const queryClient = useQueryClient()
  const mutationOptions = {
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => {},
  }
  const register = useMutation({
    ...trpc.projectRegister.mutationOptions(),
    ...mutationOptions,
  })
  const relocate = useMutation({
    ...trpc.projectRelocate.mutationOptions(),
    ...mutationOptions,
  })
  return {
    isPending: register.isPending || relocate.isPending,
    isRunning: () => queryClient.isMutating() > 0,
    register,
    relocate,
  }
}
