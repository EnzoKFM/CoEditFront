import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/authContext'
import { MAX_CHAT_MESSAGE_LENGTH, useDocumentChat, type ChatMessage } from '../../chat/useDocumentChat'
import { Button } from '../shared/Button'

const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const MESSAGE_GROUP_DELAY_MS = 5 * 60 * 1000

function startsNewGroup(message: ChatMessage, previousMessage: ChatMessage | undefined) {
    if (!previousMessage || previousMessage.author.userId !== message.author.userId) return true
    return Date.parse(message.sentAt) - Date.parse(previousMessage.sentAt) > MESSAGE_GROUP_DELAY_MS
}

export function ChatPanel({isJoined, chat }: {isJoined: boolean; chat: ReturnType<typeof useDocumentChat> }) {
    const { user } = useAuth()
    const { messages, error, isSending, sendMessage } = chat
    const [draft, setDraft] = useState('')
    const listRef = useRef<HTMLUListElement>(null)

    useEffect(() => {
        const list = listRef.current
        if (list) list.scrollTop = list.scrollHeight
    }, [messages.length])

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!draft.trim()) return
        if (await sendMessage(draft)) setDraft('')
    }

    return (
        <section aria-labelledby="chat-title" className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white">
            <header className="shrink-0 border-b border-slate-100 px-4 py-3">
                <h2 id="chat-title" className="text-base font-semibold text-slate-900">
                    Messages
                </h2>
                <p className="text-xs text-slate-500">
                    Effacés quand tout le monde a quitté le document.
                </p>
            </header>

            <ul ref={listRef} aria-live="polite" aria-label="Messages du document" className="max-h-80 overflow-y-auto px-4 py-3 xl:max-h-none xl:min-h-0 xl:flex-1">
                {messages.length === 0 && (
                    <li className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
                        Aucun message pour le moment.
                    </li>
                )}
                {messages.map((message, index) => {
                    const isMine = message.author.userId === user?.id
                    const isGroupStart = startsNewGroup(message, messages[index - 1])
                    return (
                        <li key={message.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} ${isGroupStart ? 'mt-3 first:mt-0' : 'mt-1'}`}>
                            {isGroupStart && (
                                <p className="mb-1 text-xs text-slate-500">
                                    <span className="font-medium text-slate-700">{isMine ? 'Vous' : message.author.name}</span>
                                    {' · '}
                                    <time dateTime={message.sentAt}>{timeFormatter.format(new Date(message.sentAt))}</time>
                                </p>
                            )}
                            <p
                                title={isGroupStart ? undefined : timeFormatter.format(new Date(message.sentAt))}
                                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${isMine ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'}`}
                            >
                                {message.text}
                            </p>
                        </li>
                    )
                })}
            </ul>

            <form onSubmit={handleSubmit} className="shrink-0 space-y-2 border-t border-slate-100 p-3">
                <label htmlFor="chat-message" className="sr-only">
                    Votre message
                </label>
                <div className="flex gap-2">
                    <input
                        id="chat-message"
                        type="text"
                        autoComplete="off"
                        maxLength={MAX_CHAT_MESSAGE_LENGTH}
                        placeholder={isJoined ? 'Écrire un message…' : 'Connexion au document…'}
                        disabled={!isJoined}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                    />
                    <Button type="submit" variant="primary" disabled={!isJoined || isSending || !draft.trim()}>
                        Envoyer
                    </Button>
                </div>
                {draft.length > MAX_CHAT_MESSAGE_LENGTH * 0.9 && (
                    <p className="text-right text-xs text-slate-500">
                        {draft.length} / {MAX_CHAT_MESSAGE_LENGTH}
                    </p>
                )}
                {error && (
                    <p role="alert" className="text-sm text-red-700">
                        {error}
                    </p>
                )}
            </form>
        </section>
    )
}
