import { useEffect, useState } from "react";

type Node = {
    id: number;
    name: string;
    type: "folder" | "file";
    childrenCount?: number;
    size?: number;
    updatedAt: string;
};

function Arborescence() {
    const [folders, setFolders] = useState<Node[]>([]);
    const [currentFolder, setCurrentFolder] = useState<number | null>(null);
    const [currentFolderData, setCurrentFolderData] = useState<{
        id: number;
        name: string;
        parentId: number | null;
    } | null>(null);
    const [moveNodeId, setMoveNodeId] = useState<number | null>(null);
    const [moveNodeName, setMoveNodeName] = useState("");
    const [moveFolders, setMoveFolders] = useState<(Node & { depth: number })[]>([]);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [breadcrumb, setBreadcrumb] = useState< { id: number; name: string }[] >([]);
    const [selectedMoveFolder, setSelectedMoveFolder] = useState<number | null>(null);

    useEffect(() => {
        fetch("http://localhost:3000/api/folders/root/children")
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Impossible de charger l'arborescence");
                }

                return response.json();
            })
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
        fetch(`http://localhost:3000/api/folders/${folderId}/children`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Impossible de charger le dossier");
                }

                return response.json();
            })
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

        fetch("http://localhost:3000/api/nodes", {
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
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Impossible de créer le dossier");
                }

                return response.json();
            })
            .then((data) => {
                console.log(data);

                if (currentFolder === null) {
                    return fetch(
                        "http://localhost:3000/api/folders/root/children"
                    )
                        .then((response) => {
                            if (!response.ok) {
                                throw new Error(
                                    "Impossible de recharger l'arborescence"
                                );
                            }

                            return response.json();
                        })
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

        fetch("http://localhost:3000/api/nodes", {
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
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Impossible de créer le fichier");
                }

                return response.json();
            })
            .then((data) => {
                console.log(data);

                if (currentFolder === null) {
                    return fetch(
                        "http://localhost:3000/api/folders/root/children"
                    )
                        .then((response) => {
                            if (!response.ok) {
                                throw new Error(
                                    "Impossible de recharger l'arborescence"
                                );
                            }

                            return response.json();
                        })
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

        fetch(`http://localhost:3000/api/nodes/${nodeId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: newName,
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Impossible de renommer cet élément");
                }

                return response.json();
            })
            .then((data) => {
                console.log(data);

                if (currentFolder === null) {
                    return fetch(
                        "http://localhost:3000/api/folders/root/children"
                    )
                        .then((response) => {
                            if (!response.ok) {
                                throw new Error(
                                    "Impossible de recharger l'arborescence"
                                );
                            }

                            return response.json();
                        })
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
        const confirmed = confirm(`Voulez-vous supprimer "${nodeName}" ?`);

        if (!confirmed) {
            return;
        }

        fetch(`http://localhost:3000/api/nodes/${nodeId}`, {
            method: "DELETE",
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Erreur lors de la suppression");
                }

                if (currentFolder === null) {
                    return fetch(
                        "http://localhost:3000/api/folders/root/children"
                    )
                        .then((response) => {
                            if (!response.ok) {
                                throw new Error(
                                    "Impossible de recharger l'arborescence"
                                );
                            }

                            return response.json();
                        })
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
        const folders: (Node & { depth: number })[] = [];

        async function loadFolders(
            parentId: number | null,
            depth: number
        ) {
            const url =
                parentId === null
                    ? "http://localhost:3000/api/folders/root/children"
                    : `http://localhost:3000/api/folders/${parentId}/children`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("Impossible de charger les dossiers");
            }

            const data = await response.json();

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

        fetch(`http://localhost:3000/api/nodes/${moveNodeId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                parentId: selectedMoveFolder,
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Erreur lors du déplacement");
                }

                setShowMoveModal(false);
                setMoveNodeId(null);
                setMoveNodeName("");
                setSelectedMoveFolder(null);

                if (currentFolder === null) {
                    return fetch(
                        "http://localhost:3000/api/folders/root/children"
                    )
                        .then((response) => {
                            if (!response.ok) {
                                throw new Error(
                                    "Impossible de recharger l'arborescence"
                                );
                            }

                            return response.json();
                        })
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
        fetch("http://localhost:3000/api/folders/root/children")
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Impossible de charger la racine");
                }

                return response.json();
            })
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
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="m-0 mb-1.5 text-3xl font-semibold">📁 Arborescence</h1>
                </div>

                <div className="flex gap-2.5">
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

            <div className="flex items-center gap-1.5 mb-4 text-sm">
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
                        className="flex items-center justify-between p-3 mb-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => {
                            if (folder.type === "folder") {
                                openFolder(folder.id);
                            }
                        }}
                    >
                        <div className="flex items-center gap-2.5">
                            <span className="text-xl">
                                {folder.type === "folder" ? "📁" : "📄"}
                            </span>

                            <span className="text-[15px] text-gray-700">
                                {folder.name}
                            </span>
                        </div>

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