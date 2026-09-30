import { formatDateTime, formatRelativeTime } from "./lib/formatDate";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { apiFetch, getErrorMessage } from "./lib/api";
import { uploadBinaryFile } from "./documents/binaryFileApi";
import { getFileIcon, isBinaryFile } from "./documents/binaryFileKind";
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

const DELETED_AUTHOR_NAME = "un compte supprimé";

function describeNodeHistory(node: DocumentNode) {
    const updatedByName = node.updatedBy?.name ?? DELETED_AUTHOR_NAME;
    const lines = [`Modifié le ${formatDateTime(node.updatedAt)} par ${updatedByName}`];
    if (node.createdAt) {
        lines.unshift(`Créé le ${formatDateTime(node.createdAt)} par ${node.createdBy?.name ?? DELETED_AUTHOR_NAME}`);
    }
    return lines.join("\n");
}

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
    const latestNavigationRequestId = useRef(0);
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
            setFolders((currentNodes) => currentNodes.map((currentNode) => currentNode.id === replacedFile.id ? { ...currentNode, name: replacedFile.name, mimeType: replacedFile.mimeType, size: replacedFile.size, updatedAt: replacedFile.updatedAt } : currentNode));
        }
    }

    useEffect(() => {
        apiFetch<FolderResponse>("/api/folders/root/children")
            .then((data) => {
                setFolders(data.children);
                setBreadcrumb([]);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de charger l'arborescence.");
            });
        loadSharedFolders();
    }, []);

    useEffect(() => {
        if (showMoveModal) {
            moveDialog.current?.showModal();
        }
    }, [showMoveModal]);

    function loadSharedFolders() {
        listSharedFolders()
            .then(setSharedFolders)
            .catch((error) => {
                console.error(error);
                alert("Impossible de charger les dossiers partagés.");
            });
    }


    function openFolder(folderId: number) {
        const navigationRequestId = ++latestNavigationRequestId.current;
        apiFetch<FolderResponse>(`/api/folders/${folderId}/children`)
            .then((data) => {
                if (navigationRequestId !== latestNavigationRequestId.current) {
                    return;
                }
                setFolders(data.children);
                setCurrentFolder(folderId);
                setCurrentFolderData(data.folder);
                setBreadcrumb(data.breadcrumb);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible d'ouvrir ce dossier.");
            });
    }

    function goBack() {
        if (currentFolderData === null) {
            return;
        }

        if (currentFolderData.parentId === null) {
            openRoot();
            return;
        }

        openFolder(currentFolderData.parentId);
    }

    function createFolder() {
        const name = prompt("Nom du dossier :");

        if (!name) {
            return;
        }

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
                if (currentFolder === null) {
                    return apiFetch<FolderResponse>("/api/folders/root/children")
                        .then((data) => {
                            setFolders(data.children);
                        });
                }

                openFolder(currentFolder);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de créer le dossier.");
            });
    }

    function createFile() {
        const name = prompt("Nom du fichier :");

        if (!name) {
            return;
        }

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

                if (currentFolder === null) {
                    return apiFetch<FolderResponse>("/api/folders/root/children")
                        .then((data) => {
                            setFolders(data.children);
                        });
                }

                openFolder(currentFolder);
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

        uploadBinaryFile(importedFile, currentFolder)
            .then((createdFile) => {
                onFileSelect?.(createdFile, [...breadcrumb.map((folder) => folder.id), ...(currentFolder === null ? [] : [currentFolder])]);

                if (currentFolder === null) {
                    return apiFetch<FolderResponse>("/api/folders/root/children")
                        .then((data) => {
                            setFolders(data.children);
                        });
                }

                openFolder(currentFolder);
            })
            .catch((error) => {
                console.error(error);
                alert(`Impossible d'importer le fichier : ${getErrorMessage(error)}`);
            });
    }

    function renameNode(nodeId: number, currentName: string) {
        const newName = prompt("Nouveau nom :", currentName);

        if (!newName || newName === currentName) {
            return;
        }

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

                if (currentFolder === null) {
                    return apiFetch<FolderResponse>("/api/folders/root/children")
                        .then((data) => {
                            setFolders(data.children);
                        });
                }

                openFolder(currentFolder);
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

        apiFetch<FolderResponse>(`/api/nodes/${nodeId}`, {
            method: "DELETE",
        })
            .then(() => {
                onNodeDeleted?.(nodeId);
                if (currentFolder === null) {
                    return apiFetch<FolderResponse>("/api/folders/root/children")
                        .then((data) => {
                            setFolders(data.children);
                        });
                }

                openFolder(currentFolder);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de supprimer cet élément.");
            });
    }

    async function moveNode(nodeId: number, nodeName: string) {
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
        }
    }

    function confirmMove() {
        if (moveNodeId === null || selectedMoveFolder === null) {
            return;
        }

        const destinationFolderId = selectedMoveFolder === ROOT_DESTINATION ? null : selectedMoveFolder;

        apiFetch<FolderResponse>(`/api/nodes/${moveNodeId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                parentId: destinationFolderId,
            }),
        })
            .then(async () => {
                if (destinationFolderId === null) {
                    onNodeMoved?.(moveNodeId, []);
                } else {
                    const destination = await apiFetch<FolderResponse>(`/api/folders/${destinationFolderId}/children`);
                    onNodeMoved?.(moveNodeId, [...destination.breadcrumb.map((folder) => folder.id), destinationFolderId]);
                }
                closeMoveModal();
                setMoveNodeId(null);
                setMoveNodeName("");
                setSelectedMoveFolder(null);

                if (currentFolder === null) {
                    return apiFetch<FolderResponse>("/api/folders/root/children")
                        .then((data) => {
                            setFolders(data.children);
                        });
                }

                openFolder(currentFolder);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de déplacer cet élément.");
            });
    }

    function closeMoveModal() {
        moveDialog.current?.close();
        setShowMoveModal(false);
        setSelectedMoveFolder(null);
    }

    function openRoot() {
        const navigationRequestId = ++latestNavigationRequestId.current;
        apiFetch<FolderResponse>("/api/folders/root/children")
            .then((data) => {
                if (navigationRequestId !== latestNavigationRequestId.current) {
                    return;
                }
                setFolders(data.children);
                setCurrentFolder(null);
                setCurrentFolderData(null);
                setBreadcrumb([]);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de revenir à la racine.");
            });
        loadSharedFolders();
    }

    return (
        <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                        Documents
                    </h2>
                </div>

                {canWrite && (
                    <div className="flex flex-wrap gap-2">
                        <button
                           className="border-0 rounded-md px-3.5 py-2.5 bg-blue-600 text-white text-sm cursor-pointer hover:bg-blue-700"
                            onClick={createFolder}
                        >
                            ➕ Nouveau dossier
                        </button>

                        <button
                            className="border-0 rounded-md px-3.5 py-2.5 bg-blue-600 text-white text-sm cursor-pointer hover:bg-blue-700"
                            onClick={createFile}
                        >
                            📄 Nouveau fichier
                        </button>

                        <button
                            className="border-0 rounded-md px-3.5 py-2.5 bg-blue-600 text-white text-sm cursor-pointer hover:bg-blue-700"
                            onClick={() => importFileInput.current?.click()}
                        >
                            📎 Importer un fichier
                        </button>

                        <input
                            ref={importFileInput}
                            type="file"
                            className="hidden"
                            onChange={importFile}
                        />
                    </div>
                )}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
                <button
                    className="border-0 rounded-md px-3.5 py-2.5 bg-blue-600 text-white text-sm cursor-pointer hover:bg-blue-700"
                    onClick={openRoot}
                >
                    🏠 Racine
                </button>

                {breadcrumb.map((item) => (
                    <span key={item.id}>
                        <span className="text-gray-400 mx-0.5">
                            &gt;
                        </span>

                        <button
                            className="border-0 bg-transparent px-1.5 py-1 text-blue-600 cursor-pointer text-sm hover:underline"
                            onClick={() => openFolder(item.id)}
                        >
                            {item.name}
                        </button>
                    </span>
                ))}
            </div>

            {currentFolder !== null && (
                <button
                    className="border border-gray-300 rounded-md px-3 py-2 mb-4 bg-white text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={goBack}
                >
                    ← Retour
                </button>
            )}

            <div>
                {folders.map((folder) => (
                    <div
                        key={folder.id}
                        className={`mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 transition-colors ${selectedFileId === folder.id ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`}
                    >
                        <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-2 text-left hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
                            aria-current={selectedFileId === folder.id ? 'true' : undefined}
                            aria-label={`${folder.type === 'folder' ? 'Ouvrir le dossier' : isBinaryFile(folder.mimeType) ? 'Ouvrir le fichier' : 'Modifier le fichier'} ${folder.name}`}
                            onClick={() => {
                                if (folder.type === 'folder') openFolder(folder.id);
                                else onFileSelect?.(folder, [...breadcrumb.map((ancestor) => ancestor.id), ...(currentFolder === null ? [] : [currentFolder])]);
                            }}
                        >
                            <span aria-hidden="true" className="text-xl">
                                {folder.type === "folder" ? "📁" : getFileIcon(folder.mimeType)}
                            </span>

                            <span className="min-w-0 break-words text-sm text-gray-700">
                                {folder.name}
                            </span>
                        </button>

                        <div className="flex items-center gap-1.5">
                            {folder.type === "folder" && canShareFolders && (
                                <button
                                    className="border-0 bg-transparent p-1 rounded cursor-pointer text-base hover:bg-gray-200"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setFolderToShare(folder);
                                    }}
                                    title="Partager"
                                >
                                    👥
                                </button>
                            )}

                            {canWrite && (
                                <button
                                    className="border-0 bg-transparent p-1 rounded cursor-pointer text-base hover:bg-gray-200"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        renameNode(folder.id, folder.name);
                                    }}
                                    title="Renommer"
                                >
                                    ✏️
                                </button>
                            )}

                            {canMoveOrDelete && (
                                <>
                                    <button
                                        className="border-0 bg-transparent p-1 rounded cursor-pointer text-base hover:bg-gray-200"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            moveNode(folder.id, folder.name);
                                        }}
                                        title="Déplacer"
                                    >
                                        📦
                                    </button>

                                    <button
                                        className="border-0 bg-transparent p-1 rounded cursor-pointer text-base hover:bg-gray-200"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            deleteNode(folder.id, folder.name);
                                        }}
                                        title="Supprimer"
                                    >
                                        🗑️
                                    </button>
                                </>
                            )}
                        </div>

                        <p className="w-full px-1 text-xs leading-5 text-gray-500" title={describeNodeHistory(folder)}>
                            Modifié <time dateTime={folder.updatedAt}>{formatRelativeTime(folder.updatedAt)}</time>
                            {" par "}{folder.updatedBy?.name ?? DELETED_AUTHOR_NAME}
                        </p>
                    </div>
                ))}
            </div>

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
                            <span aria-hidden="true" className="relative text-xl">
                                📁
                                <span className="absolute -bottom-1 -right-1.5 text-xs">👥</span>
                            </span>

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
                            disabled={selectedMoveFolder === null}
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
