import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Socket } from 'socket.io-client'
import { useAuth } from '../../auth/authContext'
import { MAX_CHAT_MESSAGE_LENGTH, useDocumentChat } from '../../chat/useDocumentChat'
import { Button } from '../shared/Button'

const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function ChatPanel({ socket, isJoined }: { socket: Socket; isJoined: boolean }) {
    const { user } = useAuth()
    const { messages, error, isSending, sendMessage } = useDocumentChat(socket, isJoined)
    const [draft, setDraft] = useState('')
    const listEndRef = useRef<HTMLLIElement>(null)

    useEffect(() => {
        listEndRef.current?.scrollIntoView({ block: 'nearest' })
    }, [messages.length])

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!draft.trim()) return
        if (await sendMessage(draft)) setDraft('')
    }

    return (
        <section aria-labelledby="chat-title" className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 id="chat-title" className="text-lg font-semibold text-slate-900">
                Messages
            </h2>
            <p className="mt-1 text-sm text-slate-500">
                Visibles par les personnes présentes sur ce document, effacés quand tout le monde est parti.
            </p>

            <ul aria-live="polite" aria-label="Messages du document" className="mt-4 max-h-80 space-y-3 overflow-y-auto">
                {messages.length === 0 && (
                    <li className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                        Aucun message pour le moment.
                    </li>
                )}
                {messages.map((message) => {
                    const isMine = message.author.userId === user?.id
                    return (
                        <li key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isMine ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                                <p className={`text-xs ${isMine ? 'text-indigo-100' : 'text-slate-500'}`}>
                                    {isMine ? 'Vous' : message.author.name} · <time dateTime={message.sentAt}>{timeFormatter.format(new Date(message.sentAt))}</time>
                                </p>
                                <p className="mt-1 whitespace-pre-wrap break-words">
                                    {message.text}
                                </p>
                            </div>
                        </li>
                    )
                })}
                <li ref={listEndRef} aria-hidden="true" />
            </ul>

            <form onSubmit={handleSubmit} className="mt-4 space-y-2">
                <label htmlFor="chat-message" className="sr-only">
                    Votre message
                </label>
                <div className="flex gap-2">
                    <input
                        id="chat-message"
                        type="text"
                        autoComplete="off"
                        maxLength={MAX_CHAT_MESSAGE_LENGTH}
                        placeholder={isJoined ? 'Écrire un message…' : 'Connexion au salon…'}
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
