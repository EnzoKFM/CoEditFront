import { useEffect, useState } from "react";
import "./Arborescence.css";

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
            .then((response) => response.json())
            .then((data) => {
                setFolders(data.children);
                setBreadcrumb([]);
            });
    }, []);

    function openFolder(folderId: number) {
        fetch(`http://localhost:3000/api/folders/${folderId}/children`)
            .then((response) => response.json())
            .then((data) => {
                setFolders(data.children);
                setCurrentFolder(folderId);
                setCurrentFolderData(data.folder);
                setBreadcrumb(data.breadcrumb);
            });
    }

    function goBack() {
        if (currentFolderData === null) {
            return;
        }

        if (currentFolderData.parentId === null) {
            fetch("http://localhost:3000/api/folders/root/children")
                .then((response) => response.json())
                .then((data) => {
                    setFolders(data.children);
                    setCurrentFolder(null);
                    setCurrentFolderData(null);
                    setBreadcrumb([]);
                });

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
            .then((response) => response.json())
            .then((data) => {
                console.log(data);

                if (currentFolder === null) {
                    fetch("http://localhost:3000/api/folders/root/children")
                        .then((response) => response.json())
                        .then((data) => {
                            setFolders(data.children);
                        });
                } else {
                    openFolder(currentFolder);
                }
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
            .then((response) => response.json())
            .then((data) => {
                console.log(data);

                if (currentFolder === null) {
                    fetch("http://localhost:3000/api/folders/root/children")
                        .then((response) => response.json())
                        .then((data) => {
                            setFolders(data.children);
                        });
                } else {
                    openFolder(currentFolder);
                }
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
            .then((response) => response.json())
            .then((data) => {
                console.log(data);

                if (currentFolder === null) {
                    fetch("http://localhost:3000/api/folders/root/children")
                        .then((response) => response.json())
                        .then((data) => {
                            setFolders(data.children);
                        });
                } else {
                    openFolder(currentFolder);
                }
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
                    fetch("http://localhost:3000/api/folders/root/children")
                        .then((response) => response.json())
                        .then((data) => {
                            setFolders(data.children);
                        });
                } else {
                    openFolder(currentFolder);
                }
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
                    fetch("http://localhost:3000/api/folders/root/children")
                        .then((response) => response.json())
                        .then((data) => {
                            setFolders(data.children);
                        });
                } else {
                    openFolder(currentFolder);
                }
            })
            .catch((error) => {
                console.error(error);
                alert("Impossible de déplacer cet élément.");
            });
    }

    return (
        <div>
            <div className="arbo-header">
                <div>
                    <h1>📁 Arborescence</h1>
                </div>

                <div className="header-actions">
                    <button
                        className="create-button"
                        onClick={createFolder}
                    >
                        ➕ Nouveau dossier
                    </button>

                    <button
                        className="create-button"
                        onClick={createFile}
                    >
                        📄 Nouveau fichier
                    </button>
                </div>
            </div>

            <div className="breadcrumb">
                <button
                    className="breadcrumb-item"
                    onClick={() => {
                        fetch("http://localhost:3000/api/folders/root/children")
                            .then((response) => response.json())
                            .then((data) => {
                                setFolders(data.children);
                                setCurrentFolder(null);
                                setCurrentFolderData(null);
                                setBreadcrumb([]);
                            });
                    }}
                >
                    🏠 Racine
                </button>

                {breadcrumb.map((item) => (
                    <span key={item.id}>
                        <span className="breadcrumb-separator">
                            &gt;
                        </span>

                        <button
                            className="breadcrumb-item"
                            onClick={() => openFolder(item.id)}
                        >
                            {item.name}
                        </button>
                    </span>
                ))}
            </div>

            {currentFolder !== null && (
                <button
                    className="back-button"
                    onClick={goBack}
                >
                    ← Retour
                </button>
            )}

            <div>
                {folders.map((folder) => (
                    <div
                        key={folder.id}
                        className="node-row"
                        onClick={() => {
                            if (folder.type === "folder") {
                                openFolder(folder.id);
                            }
                        }}
                    >
                        <div className="node-info">
                            <span className="node-icon">
                                {folder.type === "folder" ? "📁" : "📄"}
                            </span>

                            <span className="node-name">
                                {folder.name}
                            </span>
                        </div>

                        <div className="node-actions">
                            <button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    renameNode(folder.id, folder.name);
                                }}
                                title="Renommer"
                            >
                                ✏️
                            </button>

                            <button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    moveNode(folder.id, folder.name);
                                }}
                                title="Déplacer"
                            >
                                📦
                            </button>

                            <button
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
                <div className="modal-overlay">
                    <div className="move-modal">
                        <div className="move-modal-header">
                            <h2>Déplacer "{moveNodeName}"</h2>

                            <button
                                className="modal-close"
                                onClick={() => {
                                    setShowMoveModal(false);
                                    setSelectedMoveFolder(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <p className="move-modal-description">
                            Choisissez le dossier de destination :
                        </p>

                        <div className="folder-tree">
                            {moveFolders.map((folder) => (
                                <button
                                    key={folder.id}
                                    className={`folder-option ${
                                        selectedMoveFolder === folder.id
                                            ? "selected"
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

                        <div className="move-modal-footer">
                            <button
                                className="cancel-button"
                                onClick={() => {
                                    setShowMoveModal(false);
                                    setSelectedMoveFolder(null);
                                }}
                            >
                                Annuler
                            </button>

                            <button
                                className="move-button"
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