import { uploadBinaryFile } from "./documents/binaryFileApi";
import { DocumentBrowser } from "./components/documents/DocumentBrowser";
import { Icon } from "./components/shared/Icon";
import type { MenuAction } from "./components/shared/ActionMenu";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { apiFetch, getErrorMessage } from "./lib/api";
import { ShareFolderDialog } from "./components/share/ShareFolderDialog";
import { listSharedFolders, sharePermissionLabels, type SharedFolder } from "./shares/shareApi";

export type NodeAuthor = {
    id: number;
    name: string;
};

export type DocumentNode = {
    id: number;
    name: string;
    type: "folder" | "file";
    childrenCount?: number;
    size?: number;
    createdAt?: string;
    createdBy?: NodeAuthor | null;
    mimeType?: string | null;
    updatedAt: string;
    updatedBy?: NodeAuthor | null;
};

type FolderResponse = {
    folder: {
        id: number;
        name: string;
        parentId: number | null;
        permission: "owner" | "read" | "write" | "delete";
    } | null;
    breadcrumb: {
        id: number;
        name: string;
    }[];
    children: DocumentNode[];
};

interface ArborescenceProps {
    selectedFileId?: number;
    replacedFile?: DocumentNode | null;
    onFileSelect?: (file: DocumentNode, ancestorIds: number[]) => void;
    onNodeRenamed?: (nodeId: number, name: string) => void;
    onNodeDeleted?: (nodeId: number) => void;
    onNodeMoved?: (nodeId: number, ancestorIds: number[]) => void;
    canDeleteNode?: (nodeId: number) => boolean;
}

const ROOT_DESTINATION = "root";

type MoveDestination = number | typeof ROOT_DESTINATION;

function Arborescence({ selectedFileId, replacedFile, onFileSelect, onNodeRenamed, onNodeDeleted, onNodeMoved, canDeleteNode }: ArborescenceProps) {
    const [folders, setFolders] = useState<DocumentNode[]>([]);
    const [currentFolder, setCurrentFolder] = useState<number | null>(null);
    const [currentFolderData, setCurrentFolderData] = useState<FolderResponse["folder"]>(null);
    const [moveNodeId, setMoveNodeId] = useState<number | null>(null);
    const [moveNodeName, setMoveNodeName] = useState("");
    const [moveFolders, setMoveFolders] = useState<(DocumentNode & { depth: number })[]>([]);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [breadcrumb, setBreadcrumb] = useState< { id: number; name: string }[] >([]);
    const [selectedMoveFolder, setSelectedMoveFolder] = useState<MoveDestination | null>(null);
    const [sharedFolders, setSharedFolders] = useState<SharedFolder[]>([]);
    const [folderToShare, setFolderToShare] = useState<DocumentNode | null>(null);
    const [isMovePending, setIsMovePending] = useState(false);

    const moveDialog = useRef<HTMLDialogElement>(null);
    const importFileInput = useRef<HTMLInputElement>(null);
    const [appliedReplacedFile, setAppliedReplacedFile] = useState(replacedFile);
    const currentPermission = currentFolder === null ? "owner" : currentFolderData?.permission ?? "read";
    const canShareFolders = currentPermission === "owner";
    const canWrite = currentPermission !== "read";
    const canMoveOrDelete = currentPermission === "owner" || currentPermission === "delete";

    if (replacedFile !== appliedReplacedFile) {
        setAppliedReplacedFile(replacedFile);
        if (replacedFile) {
            setFolders((currentNodes) => currentNodes.map((currentNode) => currentNode.id === replacedFile.id ? { ...currentNode, ...replacedFile } : currentNode));
        }
    }
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const folderRequest = useRef(0);

    const loadFolder = useCallback((folderId: number | null) => {
        const requestId = ++folderRequest.current;
        return apiFetch<FolderResponse>(folderId === null ? "/api/folders/root/children" : `/api/folders/${folderId}/children`)
            .then((response) => {
                if (requestId !== folderRequest.current) return;
                setLoadError("");
                setFolders(response.children);
                setCurrentFolder(folderId);
                setCurrentFolderData(response.folder);
                setBreadcrumb(response.breadcrumb);
            })
            .catch(() => {
                if (requestId === folderRequest.current) setLoadError("Impossible de charger ce dossier. Réessayez.");
            })
            .finally(() => {
                if (requestId === folderRequest.current) setLoading(false);
            });
    }, []);
    useEffect(() => {
        void loadFolder(null);
        loadSharedFolders();
    }, [loadFolder]);

    useEffect(() => {
        if (showMoveModal) {
            moveDialog.current?.showModal();
        }
    }, [showMoveModal]);

    function loadSharedFolders() {
        listSharedFolders()
            .then(setSharedFolders)
            .catch(() => setLoadError("Impossible de charger les dossiers partagés. Réessayez."));
    }

    function reloadCurrentFolderUnlessNavigated(folderRequestAtChange: number) {
        if (folderRequestAtChange === folderRequest.current) return loadFolder(currentFolder);
    }

    function openFolder(folderId: number) {
        setLoading(true);
        void loadFolder(folderId);
    }
    function createFolder() {
        const name = prompt("Nom du dossier :")?.trim();

        if (!name) {
            return;
        }

        const folderRequestAtChange = folderRequest.current;
        apiFetch<FolderResponse>("/api/nodes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                parentId: currentFolder,
                type: "folder",
                name: name,
            }),
        })
            .then(() => {
                return reloadCurrentFolderUnlessNavigated(folderRequestAtChange);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de créer le dossier.");
            });
    }

    function createFile() {
        const name = prompt("Nom du fichier :")?.trim();

        if (!name) {
            return;
        }

        const folderRequestAtChange = folderRequest.current;
        apiFetch<DocumentNode>("/api/nodes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                parentId: currentFolder,
                type: "file",
                name: name,
            }),
        })
            .then((createdFile) => {
                onFileSelect?.(createdFile, [...breadcrumb.map((folder) => folder.id), ...(currentFolder === null ? [] : [currentFolder])]);

                return reloadCurrentFolderUnlessNavigated(folderRequestAtChange);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de créer le fichier.");
            });
    }

    function importFile(event: ChangeEvent<HTMLInputElement>) {
        const importedFile = event.target.files?.[0];
        event.target.value = "";

        if (!importedFile) {
            return;
        }

        const folderRequestAtChange = folderRequest.current;
        uploadBinaryFile(importedFile, currentFolder)
            .then((createdFile) => {
                onFileSelect?.(createdFile, [...breadcrumb.map((folder) => folder.id), ...(currentFolder === null ? [] : [currentFolder])]);

                return reloadCurrentFolderUnlessNavigated(folderRequestAtChange);
            })
            .catch((error) => {
                console.error(error);
                alert(`Impossible d'importer le fichier : ${getErrorMessage(error)}`);
            });
    }

    function renameNode(nodeId: number, currentName: string) {
        const newName = prompt("Nouveau nom :", currentName)?.trim();

        if (!newName || newName === currentName) {
            return;
        }

        const folderRequestAtChange = folderRequest.current;
        apiFetch<FolderResponse>(`/api/nodes/${nodeId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: newName,
            }),
        })
            .then(() => {
                onNodeRenamed?.(nodeId, newName);

                return reloadCurrentFolderUnlessNavigated(folderRequestAtChange);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de renommer cet élément.");
            });
    }

    function deleteNode(nodeId: number, nodeName: string) {
        if (canDeleteNode && !canDeleteNode(nodeId)) {
            return;
        }
        const confirmed = confirm(`Voulez-vous supprimer "${nodeName}" ?`);

        if (!confirmed) {
            return;
        }

        const folderRequestAtChange = folderRequest.current;
        apiFetch<FolderResponse>(`/api/nodes/${nodeId}`, {
            method: "DELETE",
        })
            .then(() => {
                onNodeDeleted?.(nodeId);
                return reloadCurrentFolderUnlessNavigated(folderRequestAtChange);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de supprimer cet élément.");
            });
    }

    async function moveNode(nodeId: number, nodeName: string) {
        if (isMovePending) {
            return;
        }

        const folders: (DocumentNode & { depth: number })[] = [];

        async function loadFolders(
            parentId: number | null,
            depth: number
        ) {
            const url =
                parentId === null
                    ? "/api/folders/root/children"
                    : `/api/folders/${parentId}/children`;

            const data = await apiFetch<FolderResponse>(url);

            for (const item of data.children) {
                if (item.type === "folder" && item.id !== nodeId) {
                    folders.push({
                        ...item,
                        depth: depth,
                    });

                    await loadFolders(item.id, depth + 1);
                }
            }
        }

        setIsMovePending(true);
        try {
            await loadFolders(null, 0);

            setMoveFolders(folders);
            setMoveNodeId(nodeId);
            setMoveNodeName(nodeName);
            setSelectedMoveFolder(null);
            setShowMoveModal(true);
        } catch (error) {
            console.error(error);
            alert("Impossible de récupérer les dossiers.");
        } finally {
            setIsMovePending(false);
        }
    }

    function getMoveDestinationAncestorIds(destinationFolderId: number) {
        const destinationIndex = moveFolders.findIndex((moveFolder) => moveFolder.id === destinationFolderId);
        const ancestorIds = [destinationFolderId];
        let ancestorDepth = moveFolders[destinationIndex].depth - 1;
        for (let folderIndex = destinationIndex - 1; folderIndex >= 0 && ancestorDepth >= 0; folderIndex -= 1) {
            if (moveFolders[folderIndex].depth === ancestorDepth) {
                ancestorIds.unshift(moveFolders[folderIndex].id);
                ancestorDepth -= 1;
            }
        }
        return ancestorIds;
    }

    function confirmMove() {
        if (moveNodeId === null || selectedMoveFolder === null || isMovePending) {
            return;
        }

        const destinationFolderId = selectedMoveFolder === ROOT_DESTINATION ? null : selectedMoveFolder;
        const folderRequestAtChange = folderRequest.current;

        setIsMovePending(true);
        apiFetch<FolderResponse>(`/api/nodes/${moveNodeId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                parentId: destinationFolderId,
            }),
        })
            .then(() => {
                onNodeMoved?.(moveNodeId, destinationFolderId === null ? [] : getMoveDestinationAncestorIds(destinationFolderId));
                closeMoveModal();
                setMoveNodeId(null);
                setMoveNodeName("");
                setSelectedMoveFolder(null);

                return reloadCurrentFolderUnlessNavigated(folderRequestAtChange);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de déplacer cet élément.");
            })
            .finally(() => setIsMovePending(false));
    }

    function closeMoveModal() {
        moveDialog.current?.close();
        setShowMoveModal(false);
        setSelectedMoveFolder(null);
    }

    function openRoot() {
        setLoading(true);
        void loadFolder(null);
        loadSharedFolders();
    }
    return (
        <div>
            <input ref={importFileInput} type="file" className="hidden" onChange={importFile} />
            <DocumentBrowser
                folders={folders}
                loading={loading}
                error={loadError}
                onRetry={() => { setLoading(true); void loadFolder(currentFolder); loadSharedFolders(); }}
                currentFolder={currentFolder}
                folderName={currentFolderData?.name}
                breadcrumb={breadcrumb}
                selectedFileId={selectedFileId}
                canWrite={canWrite}
                onOpenFolder={openFolder}
                onOpenRoot={openRoot}
                onCreateFolder={createFolder}
                onCreateFile={createFile}
                onImportFile={() => importFileInput.current?.click()}
                onOpenFile={(file) => onFileSelect?.(file, [...breadcrumb.map((ancestor) => ancestor.id), ...(currentFolder === null ? [] : [currentFolder])])}
                getActions={(node) => {
                    const actions: MenuAction[] = [];
                    if (node.type === "folder" && canShareFolders) actions.push({ label: "Partager", icon: "users", onClick: () => setFolderToShare(node) });
                    if (canWrite) actions.push({ label: "Renommer", icon: "edit", onClick: () => renameNode(node.id, node.name) });
                    if (canMoveOrDelete) {
                        actions.push({ label: "Déplacer", icon: "move", onClick: () => { void moveNode(node.id, node.name); } });
                        actions.push({ label: "Supprimer", icon: "trash", danger: true, onClick: () => deleteNode(node.id, node.name) });
                    }
                    return actions;
                }}
            />
            {currentFolder === null && sharedFolders.length > 0 && (
                <div className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-slate-900">
                        Partagés avec moi
                    </h3>

                    {sharedFolders.map((sharedFolder) => (
                        <button
                            key={sharedFolder.id}
                            type="button"
                            className="mb-2 flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-left hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
                            aria-label={`Ouvrir le dossier partagé ${sharedFolder.name}`}
                            onClick={() => openFolder(sharedFolder.id)}
                        >
                            <Icon name="users" className="size-6 shrink-0 text-indigo-500" />

                            <span className="min-w-0 flex-1">
                                <span className="block break-words text-sm text-gray-700">
                                    {sharedFolder.name}
                                </span>
                                <span className="block text-xs text-slate-500">
                                    {sharedFolder.owner.email ? `Partagé par ${sharedFolder.owner.firstName} ${sharedFolder.owner.lastName}` : "Propriétaire supprimé"} · {sharePermissionLabels[sharedFolder.permission]}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {folderToShare && (
                <ShareFolderDialog
                    folderId={folderToShare.id}
                    folderName={folderToShare.name}
                    onClose={() => setFolderToShare(null)}
                />
            )}

            {showMoveModal && (
                <dialog
                    ref={moveDialog}
                    aria-labelledby="move-dialog-title"
                    onCancel={(event) => {
                        event.preventDefault();
                        closeMoveModal();
                    }}
                    className="m-auto w-[500px] max-w-[90%] overflow-hidden rounded-xl border-0 bg-white p-0 shadow-2xl backdrop:bg-black/45"
                >
                    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                        <h2 id="move-dialog-title" className="m-0 text-xl font-semibold">Déplacer "{moveNodeName}"</h2>

                        <button
                            type="button"
                            aria-label="Fermer"
                            className="rounded border-0 bg-transparent p-1 text-lg cursor-pointer hover:bg-gray-100"
                            onClick={closeMoveModal}
                        >
                            ✕
                        </button>
                    </div>

                    <p className="m-0 px-5 pb-2 pt-4 text-gray-500">
                        Choisissez le dossier de destination :
                    </p>

                    <div className="max-h-[350px] overflow-y-auto px-2.5 py-1">
                        <button
                            type="button"
                            className={`block w-full rounded-md border-0 bg-transparent py-2 pl-4 text-left text-sm cursor-pointer hover:bg-gray-100 ${
                                selectedMoveFolder === ROOT_DESTINATION
                                    ? "bg-blue-100 text-blue-700 font-semibold"
                                    : ""
                            }`}
                            onClick={() => {
                                setSelectedMoveFolder(ROOT_DESTINATION);
                            }}
                        >
                            🏠 Racine
                        </button>
                        {moveFolders.map((folder) => (
                            <button
                                key={folder.id}
                                className={`block w-full rounded-md border-0 bg-transparent py-2 text-left text-sm cursor-pointer hover:bg-gray-100 ${
                                    selectedMoveFolder === folder.id
                                        ? "bg-blue-100 text-blue-700 font-semibold"
                                        : ""
                                }`}
                                style={{
                                    paddingLeft: `${16 + folder.depth * 25}px`,
                                }}
                                onClick={() => {
                                    setSelectedMoveFolder(folder.id);
                                }}
                            >
                                📁 {folder.name}
                            </button>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2.5 border-t border-gray-200 px-5 py-4">
                        <button
                            className="rounded-md border border-gray-300 bg-white px-3.5 py-2 text-gray-700 cursor-pointer hover:bg-gray-100"
                            onClick={closeMoveModal}
                        >
                            Annuler
                        </button>

                        <button
                            className="rounded-md border-0 bg-blue-600 px-3.5 py-2 text-white cursor-pointer hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                            disabled={selectedMoveFolder === null || isMovePending}
                            onClick={confirmMove}
                        >
                            📦 Déplacer ici
                        </button>
                    </div>
                </dialog>
            )}
        </div>
    );
}

export default Arborescence;
