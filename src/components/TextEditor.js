import Quill from 'quill';
import  "quill/dist/quill.snow.css" ;
import React, {useCallback, useEffect, useState} from 'react'
import { io } from "socket.io-client"
import { useParams } from "react-router-dom";

const SAVE_INTERVAL_MS = 2000
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
]

const TextEditor = () => {
    const { id: documentId } = useParams()
    const [socket, setSocket] = useState()
    const [quill, setQuill] = useState()

    // set the socket connection on page load
    useEffect(() => {
        const url = process.env.REACT_APP_BACKEND_BASE_URL;
        const s = io(url)
        setSocket(s);

        // ! this is a cleanup function
        // ! this is called when the component is unmounted
        // ! prevents user from connecting to multiple sockets
        return () => {
            s.disconnect()
        }
    },[])

    useEffect(() => {
        if (socket == null || quill == null) return
        // ! this is triggered when server returns the doucment from the database
        socket.once("load-document", document => {
            quill.setContents(document)
            quill.enable()
        })
        
        // ! on page load, we either get the document from DB or get a new one from server
        socket.emit("get-document", documentId)
    }, [socket, quill, documentId])

    // ! on each SAVE_INTERVAL_MS, we save the document to the database
    useEffect(() => {
        if (socket == null || quill == null) return

        const interval = setInterval(() => {
        socket.emit("save-document", quill.getContents())
        }, SAVE_INTERVAL_MS)

        return () => {
        clearInterval(interval)
        }
    }, [socket, quill])

    // ! detecting changes whenever the user makes a change to the document
    // ! then sending the delta to the server - that broadcast to all other users
    // ! using quill to get the delta of the changes
    useEffect(() => {
        if(socket == null || quill == null) return;
        const handler = (delta, oldDelta, source) => {
            if(source !== "user") return;
            socket.emit("send-changes", delta)
        }
        // ! set up event listener for changes and handler is our callback function
        quill.on("text-change", handler);

        // ! remove event listener when component is unmounted
        return () => {
            quill.off("text-change", handler)
        }

    },[socket,quill])

    useEffect(() => {
        if(socket == null || quill == null) return;

        const handler = (delta) => {
            quill.updateContents(delta)
        }

        // ! set up event listener for changes and handler is our callback function
        socket.on("receive-changes", handler);
        // ! remove event listener when component is unmounted
        return (() => {
            socket.off("receive-changes", handler)
        })
    },[socket,quill])


    // ! set the quill editor
    const quillRef = useCallback((wrapper) => {
        if(wrapper == null) return;
        wrapper.innerHTML = '';

        const editor = document.createElement('div');
        wrapper.append(editor);
        const q = new Quill(
            editor,
            {theme: 'snow', modules: {
                toolbar: TOOLBAR_OPTIONS
            }},
        );
        setQuill(q);
    },[]);

    return (
        <div id="quillContainer" className="container" ref={quillRef}></div>
    )
}

export default TextEditor