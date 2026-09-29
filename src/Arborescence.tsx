import { useEffect, useState } from "react";
import { apiFetch } from "./lib/api";

export type DocumentNode = {
    id: number;
    name: string;
    type: "folder" | "file";
    childrenCount?: number;
    size?: number;
    updatedAt: string;
};

type FolderResponse = {
    folder: {
        id: number;
        name: string;
        parentId: number | null;
    } | null;
    breadcrumb: {
        id: number;
        name: string;
    }[];
    children: DocumentNode[];
};

interface ArborescenceProps {
    selectedFileId?: number;
    onFileSelect?: (file: DocumentNode, ancestorIds: number[]) => void;
    onNodeRenamed?: (nodeId: number, name: string) => void;
    onNodeDeleted?: (nodeId: number) => void;
    onNodeMoved?: (nodeId: number, ancestorIds: number[]) => void;
    canDeleteNode?: (nodeId: number) => boolean;
}

function Arborescence({ selectedFileId, onFileSelect, onNodeRenamed, onNodeDeleted, onNodeMoved, canDeleteNode }: ArborescenceProps) {
    const [folders, setFolders] = useState<DocumentNode[]>([]);
    const [currentFolder, setCurrentFolder] = useState<number | null>(null);
    const [currentFolderData, setCurrentFolderData] = useState<{
        id: number;
        name: string;
        parentId: number | null;
    } | null>(null);
    const [moveNodeId, setMoveNodeId] = useState<number | null>(null);
    const [moveNodeName, setMoveNodeName] = useState("");
    const [moveFolders, setMoveFolders] = useState<(DocumentNode & { depth: number })[]>([]);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [breadcrumb, setBreadcrumb] = useState< { id: number; name: string }[] >([]);
    const [selectedMoveFolder, setSelectedMoveFolder] = useState<number | null>(null);

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
    }, []);


    function openFolder(folderId: number) {
        apiFetch<FolderResponse>(`/api/folders/${folderId}/children`)
            .then((data) => {
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
            .then((data) => {
                console.log(data);

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

        apiFetch<FolderResponse>(`/api/nodes/${moveNodeId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                parentId: selectedMoveFolder,
            }),
        })
            .then(async () => {
                const destination = await apiFetch<FolderResponse>(`/api/folders/${selectedMoveFolder}/children`);
                onNodeMoved?.(moveNodeId, [...destination.breadcrumb.map((folder) => folder.id), selectedMoveFolder]);
                setShowMoveModal(false);
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

    function openRoot() {
        apiFetch<FolderResponse>("/api/folders/root/children")
            .then((data) => {
                setFolders(data.children);
                setCurrentFolder(null);
                setCurrentFolderData(null);
                setBreadcrumb([]);
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de revenir à la racine.");
            });
    }

    return (
        <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                        Documents
                    </h2>
                </div>

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
                </div>
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
                            aria-label={`${folder.type === 'folder' ? 'Ouvrir le dossier' : 'Modifier le fichier'} ${folder.name}`}
                            onClick={() => {
                                if (folder.type === 'folder') openFolder(folder.id);
                                else onFileSelect?.(folder, [...breadcrumb.map((ancestor) => ancestor.id), ...(currentFolder === null ? [] : [currentFolder])]);
                            }}
                        >
                            <span aria-hidden="true" className="text-xl">
                                {folder.type === "folder" ? "📁" : "📄"}
                            </span>

                            <span className="min-w-0 break-words text-sm text-gray-700">
                                {folder.name}
                            </span>
                        </button>

                        <div className="flex items-center gap-1.5">
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
                        </div>
                    </div>
                ))}
            </div>
            {showMoveModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45">
                    <div className="w-[500px] max-w-[90%] overflow-hidden rounded-xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                            <h2 className="m-0 text-xl font-semibold">Déplacer "{moveNodeName}"</h2>

                            <button
                                className="rounded border-0 bg-transparent p-1 text-lg cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                    setShowMoveModal(false);
                                    setSelectedMoveFolder(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <p className="m-0 px-5 pb-2 pt-4 text-gray-500">
                            Choisissez le dossier de destination :
                        </p>

                        <div className="max-h-[350px] overflow-y-auto px-2.5 py-1">
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
                                onClick={() => {
                                    setShowMoveModal(false);
                                    setSelectedMoveFolder(null);
                                }}
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
                    </div>
                </div>
            )}
        </div>
    );
}

export default Arborescence;
