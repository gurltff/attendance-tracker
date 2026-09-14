import { useState } from 'react'
import { put } from '../services/store'
import { useToast } from './Shared'
import TeacherSubjectPicker from './TeacherSubjectPicker'
import type { UserProfile } from '../types'

interface Props {
  user: UserProfile
  setUser: (user: UserProfile) => void
  onClose: () => void
}

export default function TeacherSubjectManager({
  user,
  setUser,
  onClose,
}: Props) {
  const { push } = useToast()

  const [draftKeys, setDraftKeys] = useState<string[]>(
    user.assignedCourseIds ?? []
  )

  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)

    try {
      const updated: UserProfile = {
        ...user,
        assignedCourseIds: draftKeys,
      }

      await put<UserProfile & { id: string }>('users', {
        ...updated,
        id: user.uid,
      })

      setUser(updated)

      push('Subjects updated successfully.', 'success')

      onClose()
    } catch (error) {
      console.error(error)

      push('Could not update your subjects.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-40">
      <div className="card max-w-xl w-full max-h-[85vh] overflow-y-auto">

        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">
            Manage my subjects
          </h3>

          <button
            type="button"
            className="btn-outline text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <TeacherSubjectPicker
          value={draftKeys}
          onChange={setDraftKeys}
        />

        <button
          type="button"
          className="btn-primary w-full mt-4"
          disabled={saving}
          onClick={save}
        >
          {saving ? 'Saving…' : 'Save subjects'}
        </button>

      </div>
    </div>
  )
}