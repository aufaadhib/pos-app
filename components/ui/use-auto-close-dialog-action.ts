"use client"

import { useActionState, useCallback, useState } from "react"
import { toast } from "react-toastify"

/**
 * Runs a form action and closes its controlled dialog after a successful result.
 * Input consists of the action, its initial state, and an optional close toggle; output contains
 * the action state, pending state, form action, and dialog controls. Its UI side effects are
 * closing the dialog when enabled and displaying the server result through React Toastify.
 */
export function useAutoCloseDialogAction<State extends { message: string; status: string }>(
  action: (previousState: State, formData: FormData) => Promise<State>,
  initialState: State,
  closeOnSuccess = true,
) {
  const [open, setOpen] = useState(false)
  const actionWithClose = useCallback(async (previousState: State, formData: FormData) => {
    const result = await action(previousState, formData)
    if (result.status === "success") {
      toast.success(result.message)
      if (closeOnSuccess) setOpen(false)
    }
    return result
  }, [action, closeOnSuccess])
  const [state, formAction, pending] = useActionState<State, FormData>(
    actionWithClose,
    initialState as Awaited<State>,
  )

  return {
    action: formAction,
    open,
    pending,
    setOpen,
    state,
  }
}
