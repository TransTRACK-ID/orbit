// Original simple state — used by components/general/Modal
export const useModal = () => useState<boolean>('useModal', () => false)

// Extended modal with mode — used by the prototype layout
export const useModalExtended = () => {
  const isOpen = useState<boolean>('useModalExtendedOpen', () => false)
  const mode = useState<string | null>('useModalExtendedMode', () => null)

  function openModal(m: string) {
    mode.value = m
    isOpen.value = true
  }

  function closeModal() {
    isOpen.value = false
    mode.value = null
  }

  return {
    isOpen,
    mode,
    openModal,
    closeModal,
  }
}
