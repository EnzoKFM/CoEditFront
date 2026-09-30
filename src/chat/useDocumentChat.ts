import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'

export interface ChatMessage {
    id: string
    author: { userId: number; name: string }
    text: string
    sentAt: string
}

interface SendReply {
    message?: ChatMessage
    error?: string
}

interface HistoryReply {
    messages?: ChatMessage[]
    error?: string
}

export const MAX_CHAT_MESSAGE_LENGTH = 1000
const ACKNOWLEDGEMENT_TIMEOUT_MS = 10000

function mergeMessages(currentMessages: ChatMessage[], incomingMessages: ChatMessage[]) {
    const messagesById = new Map(currentMessages.map((message) => [message.id, message]))
    incomingMessages.forEach((message) => messagesById.set(message.id, message))
    return [...messagesById.values()].sort((first, second) => first.sentAt.localeCompare(second.sentAt))
}

export function useDocumentChat(socket: Socket, isJoined: boolean) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isSending, setIsSending] = useState(false)

    useEffect(() => {
        function receiveMessage(message: ChatMessage) {
            setMessages((currentMessages) => mergeMessages(currentMessages, [message]))
        }
        socket.on('chat:message', receiveMessage)
        return () => { socket.off('chat:message', receiveMessage) }
    }, [socket])

    useEffect(() => {
        if (!isJoined) return
        let isCurrent = true
        socket.timeout(ACKNOWLEDGEMENT_TIMEOUT_MS).emitWithAck('chat:history')
            .then((reply: HistoryReply) => {
                if (!isCurrent) return
                if (reply.error) setError(reply.error)
                else setMessages((currentMessages) => mergeMessages(currentMessages, reply.messages ?? []))
            })
            .catch(() => { if (isCurrent) setError('Impossible de charger les messages. Rechargez la page.') })
        return () => { isCurrent = false }
    }, [socket, isJoined])

    const sendMessage = useCallback(async (text: string) => {
        setError(null)
        setIsSending(true)
        try {
            const reply: SendReply = await socket.timeout(ACKNOWLEDGEMENT_TIMEOUT_MS).emitWithAck('chat:send', { text })
            if (reply.error || !reply.message) {
                setError(reply.error ?? 'Le message n’a pas pu être envoyé.')
                return false
            }
            const sentMessage = reply.message
            setMessages((currentMessages) => mergeMessages(currentMessages, [sentMessage]))
            return true
        } catch {
            setError('Le serveur ne répond pas. Réessayez.')
            return false
        } finally {
            setIsSending(false)
        }
    }, [socket])

    return { messages, error, isSending, sendMessage }
}
