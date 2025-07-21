import React, { useState, useEffect } from 'react';
import { Home, Search, PlusSquare, Heart, User, Send, MessageCircle, Bookmark, MoreHorizontal, Camera, Loader } from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

// Message Box Component
const MessageBox = ({ message, type, onClose }) => {
    if (!message) return null;

    const bgColor = type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700';

    return (
        <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 rounded-lg shadow-lg border ${bgColor} z-50 flex items-center justify-between`}>
            <span>{message}</span>
            <button onClick={onClose} className="ml-4 font-bold text-lg">&times;</button>
        </div>
    );
};

// Main App Component
const App = () => {
    const [currentPage, setCurrentPage] = useState('feed');
    const [posts, setPosts] = useState([]);
    const [currentUser, setCurrentUser] = useState({
        username: 'your_username',
        profilePic: 'https://placehold.co/150x150/FF6347/FFFFFF?text=YOU',
        followers: 1234,
        following: 567,
        bio: 'Welcome to my profile! Sharing moments and memories.',
        userPosts: [],
    });
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [firebaseApp, setFirebaseApp] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [messageBox, setMessageBox] = useState({ message: '', type: '', show: false });

    // Initialize Firebase and set up auth listener
    useEffect(() => {
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

            if (Object.keys(firebaseConfig).length === 0) {
                console.error("Firebase config not found. Please ensure __firebase_config is set.");
                setMessageBox({ message: 'Firebase not configured. Check console for details.', type: 'error', show: true });
                setLoading(false);
                return;
            }

            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setFirebaseApp(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Authenticate user
            const authenticateUser = async () => {
                try {
                    if (typeof __initial_auth_token !== 'undefined') {
                        await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                    } else {
                        await signInAnonymously(firebaseAuth);
                    }
                } catch (error) {
                    console.error("Firebase authentication error:", error);
                    setMessageBox({ message: `Authentication failed: ${error.message}`, type: 'error', show: true });
                }
            };

            authenticateUser();

            // Listen for auth state changes
            const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    // You might fetch user profile data here from Firestore if needed
                    setCurrentUser(prevUser => ({
                        ...prevUser,
                        username: user.isAnonymous ? 'Anonymous User' : user.uid.substring(0, 8), // Use part of UID for anonymous
                        profilePic: user.isAnonymous ? 'https://placehold.co/150x150/808080/FFFFFF?text=Anon' : prevUser.profilePic
                    }));
                } else {
                    setUserId(null);
                    setMessageBox({ message: 'User signed out.', type: 'error', show: true });
                }
                setLoading(false); // Auth state checked, stop loading
            });

            return () => unsubscribeAuth(); // Cleanup auth listener
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setMessageBox({ message: `Firebase initialization error: ${error.message}`, type: 'error', show: true });
            setLoading(false);
        }
    }, []);

    // Fetch posts from Firestore
    useEffect(() => {
        if (!db || !userId) {
            return; // Wait for Firestore and userId to be ready
        }

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const postsCollectionRef = collection(db, `artifacts/${appId}/public/data/posts`);
        const q = query(postsCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate().toLocaleString() : 'N/A'
            })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by timestamp descending

            setPosts(fetchedPosts);
            // Update user's own posts for the profile page
            setCurrentUser(prevUser => ({
                ...prevUser,
                userPosts: fetchedPosts.filter(post => post.userId === userId)
            }));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching posts:", error);
            setMessageBox({ message: `Error fetching posts: ${error.message}`, type: 'error', show: true });
            setLoading(false);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [db, userId]); // Re-run when db or userId changes

    // Function to add a new post to Firestore
    const addPost = async (newPost) => {
        if (!db || !userId) {
            setMessageBox({ message: 'Database not ready or user not authenticated.', type: 'error', show: true });
            return;
        }

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const postsCollectionRef = collection(db, `artifacts/${appId}/public/data/posts`);

        try {
            await addDoc(postsCollectionRef, {
                ...newPost,
                userId: userId, // Add the current user's ID
                timestamp: serverTimestamp(), // Firestore server timestamp
            });
            setMessageBox({ message: 'Post uploaded successfully!', type: 'success', show: true });
            setCurrentPage('feed'); // Go back to feed after upload
        } catch (error) {
            console.error("Error adding document:", error);
            setMessageBox({ message: `Failed to upload post: ${error.message}`, type: 'error', show: true });
        }
    };

    // Header Component
    const Header = ({ setCurrentPage, userId }) => {
        return (
            <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10 shadow-sm">
                {/* Instagram Logo */}
                <h1 className="text-2xl font-semibold font-['Inter']">Instagram</h1>

                {/* Search Bar (hidden on small screens, shown on md and up) */}
                <div className="hidden md:flex items-center bg-gray-100 rounded-lg px-3 py-2 flex-grow mx-4 max-w-xs">
                    <Search className="text-gray-500 w-5 h-5 mr-2" />
                    <input
                        type="text"
                        placeholder="Search"
                        className="bg-transparent outline-none text-sm w-full"
                    />
                </div>

                {/* User ID Display */}
                {userId && (
                    <div className="hidden md:block text-xs text-gray-600 mr-4">
                        User: <span className="font-mono text-blue-600">{userId}</span>
                    </div>
                )}

                {/* Navigation Icons */}
                <nav className="flex items-center space-x-6">
                    <Home className="w-6 h-6 cursor-pointer hover:text-gray-700" onClick={() => setCurrentPage('feed')} />
                    <Send className="w-6 h-6 cursor-pointer hover:text-gray-700 transform -rotate-45" /> {/* Direct Message icon */}
                    <PlusSquare className="w-6 h-6 cursor-pointer hover:text-gray-700" onClick={() => setCurrentPage('upload')} />
                    <Heart className="w-6 h-6 cursor-pointer hover:text-gray-700" />
                    <User className="w-6 h-6 cursor-pointer hover:text-gray-700" onClick={() => setCurrentPage('profile')} />
                </nav>
            </header>
        );
    };

    // Post Component
    const Post = ({ post }) => {
        const [showAllComments, setShowAllComments] = useState(false);

        return (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 mb-6 w-full max-w-xl mx-auto">
                {/* Post Header */}
                <div className="flex items-center p-4 border-b border-gray-100">
                    <img
                        src={post.profilePic}
                        alt={`${post.username}'s profile`}
                        className="w-10 h-10 rounded-full mr-3 border-2 border-pink-500 p-0.5"
                    />
                    <span className="font-semibold text-sm">{post.username}</span>
                    <MoreHorizontal className="ml-auto w-5 h-5 text-gray-500 cursor-pointer" />
                </div>

                {/* Post Image */}
                <div className="w-full bg-gray-100 flex items-center justify-center overflow-hidden">
                    <img
                        src={post.imageUrl}
                        alt="Post"
                        className="w-full h-auto object-cover max-h-[600px]"
                        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/600x600/CCCCCC/000000?text=Image+Error`; }}
                    />
                </div>

                {/* Post Actions */}
                <div className="flex items-center justify-between p-4">
                    <div className="flex space-x-4">
                        <Heart className="w-6 h-6 cursor-pointer hover:text-red-500" />
                        <MessageCircle className="w-6 h-6 cursor-pointer hover:text-blue-500" />
                        <Send className="w-6 h-6 cursor-pointer hover:text-green-500 transform -rotate-45" />
                    </div>
                    <Bookmark className="w-6 h-6 cursor-pointer hover:text-yellow-500" />
                </div>

                {/* Likes */}
                <div className="px-4 pb-2 text-sm font-semibold">
                    {post.likes} likes
                </div>

                {/* Caption */}
                <div className="px-4 pb-2 text-sm">
                    <span className="font-semibold mr-1">{post.username}</span>
                    {post.caption}
                </div>

                {/* Comments */}
                <div className="px-4 pb-4 text-sm text-gray-600">
                    {post.comments && post.comments.length > 2 && (
                        <button
                            onClick={() => setShowAllComments(!showAllComments)}
                            className="text-gray-500 hover:text-gray-700 mb-1"
                        >
                            {showAllComments ? 'Hide comments' : `View all ${post.comments.length} comments`}
                        </button>
                    )}
                    {post.comments && (showAllComments ? post.comments : post.comments.slice(0, 2)).map((comment, index) => (
                        <p key={index}>
                            <span className="font-semibold mr-1 text-gray-800">{comment.user}</span>
                            {comment.text}
                        </p>
                    ))}
                    <p className="text-xs text-gray-400 mt-2">{post.timestamp}</p>
                </div>
            </div>
        );
    };

    // Feed Component
    const Feed = ({ posts, loading }) => {
        if (loading) {
            return (
                <div className="pt-20 pb-16 bg-gray-50 min-h-screen flex items-center justify-center">
                    <Loader className="animate-spin text-blue-500 w-10 h-10" />
                    <p className="ml-4 text-lg text-gray-600">Loading posts...</p>
                </div>
            );
        }

        return (
            <div className="pt-20 pb-16 bg-gray-50 min-h-screen">
                <div className="container mx-auto px-4 py-8">
                    {posts.length === 0 ? (
                        <p className="text-center text-gray-500 text-lg">No posts yet. Start sharing!</p>
                    ) : (
                        <div className="flex flex-col items-center">
                            {posts.map((post) => (
                                <Post key={post.id} post={post} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Profile Component
    const Profile = ({ user, userPosts, loading }) => {
        if (loading) {
            return (
                <div className="pt-20 pb-16 bg-gray-50 min-h-screen flex items-center justify-center">
                    <Loader className="animate-spin text-blue-500 w-10 h-10" />
                    <p className="ml-4 text-lg text-gray-600">Loading profile...</p>
                </div>
            );
        }

        return (
            <div className="pt-20 pb-16 bg-gray-50 min-h-screen">
                <div className="container mx-auto px-4 py-8">
                    {/* Profile Header */}
                    <div className="flex flex-col md:flex-row items-center md:items-start mb-8 p-4 bg-white rounded-lg shadow-md">
                        <img
                            src={user.profilePic}
                            alt={`${user.username}'s profile`}
                            className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover mb-4 md:mb-0 md:mr-8 border-4 border-pink-500 p-1"
                        />
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-light mb-2">{user.username}</h2>
                            <div className="flex justify-center md:justify-start space-x-6 mb-4">
                                <p className="text-sm">
                                    <span className="font-semibold">{userPosts.length}</span> posts
                                </p>
                                <p className="text-sm">
                                    <span className="font-semibold">{user.followers}</span> followers
                                </p>
                                <p className="text-sm">
                                    <span className="font-semibold">{user.following}</span> following
                                </p>
                            </div>
                            <p className="text-sm font-semibold">{user.bio}</p>
                            <button className="mt-4 px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors">
                                Edit Profile
                            </button>
                        </div>
                    </div>

                    {/* User Posts Grid */}
                    <div className="grid grid-cols-3 gap-1 bg-white p-2 rounded-lg shadow-md">
                        {userPosts.length === 0 ? (
                            <p className="col-span-3 text-center text-gray-500 text-md py-8">No posts yet.</p>
                        ) : (
                            userPosts.map((post) => (
                                <div key={post.id} className="relative w-full aspect-square overflow-hidden group">
                                    <img
                                        src={post.imageUrl}
                                        alt="User post"
                                        className="w-full h-full object-cover transform transition-transform duration-300 group-hover:scale-105"
                                        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x300/CCCCCC/000000?text=Image+Error`; }}
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="flex items-center text-white text-sm font-semibold">
                                            <Heart className="w-5 h-5 mr-1" /> {post.likes}
                                            <MessageCircle className="w-5 h-5 ml-4 mr-1" /> {post.comments.length}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Upload Component
    const Upload = ({ addPost, currentUser, setMessageBox }) => {
        const [imageFile, setImageFile] = useState(null);
        const [imageUrl, setImageUrl] = useState('');
        const [caption, setCaption] = useState('');

        const handleImageChange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // Check file size (e.g., 5MB limit)
                if (file.size > 5 * 1024 * 1024) {
                    setMessageBox({ message: 'Image size exceeds 5MB limit.', type: 'error', show: true });
                    setImageFile(null);
                    setImageUrl('');
                    return;
                }
                setImageFile(file);
                setImageUrl(URL.createObjectURL(file));
                setMessageBox({ message: '', type: '', show: false });
            }
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!imageFile) {
                setMessageBox({ message: 'Please select an image to upload.', type: 'error', show: true });
                return;
            }

            // For a real app, you'd upload the image to storage (e.g., Firebase Storage)
            // and get a public URL. Here, we're using a local Blob URL.
            const newPost = {
                username: currentUser.username,
                profilePic: currentUser.profilePic,
                imageUrl: imageUrl, // This will be a temporary local URL
                caption: caption,
                likes: 0,
                comments: [],
            };

            await addPost(newPost); // Call the addPost function that interacts with Firestore
            setImageFile(null);
            setImageUrl('');
            setCaption('');
        };

        return (
            <div className="pt-20 pb-16 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border border-gray-200">
                    <h2 className="text-2xl font-semibold mb-6 text-center">Create New Post</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-6">
                            <label htmlFor="image-upload" className="block text-sm font-medium text-gray-700 mb-2">
                                Select Image
                            </label>
                            <div className="flex items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors relative">
                                {imageUrl ? (
                                    <img
                                        src={imageUrl}
                                        alt="Preview"
                                        className="max-h-full max-w-full object-contain rounded-lg"
                                    />
                                ) : (
                                    <div className="text-center text-gray-500">
                                        <Camera className="mx-auto w-10 h-10 mb-2" />
                                        <p>Click to select or drag and drop</p>
                                    </div>
                                )}
                                <input
                                    id="image-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-2">
                                Caption
                            </label>
                            <textarea
                                id="caption"
                                rows="3"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Write a caption..."
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors font-semibold"
                        >
                            Upload Post
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    // Render content based on currentPage state
    const renderPage = () => {
        switch (currentPage) {
            case 'feed':
                return <Feed posts={posts} loading={loading} />;
            case 'profile':
                return <Profile user={currentUser} userPosts={currentUser.userPosts} loading={loading} />;
            case 'upload':
                return <Upload addPost={addPost} currentUser={currentUser} setMessageBox={setMessageBox} />;
            default:
                return <Feed posts={posts} loading={loading} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-['Inter']">
            <Header setCurrentPage={setCurrentPage} userId={userId} />
            {renderPage()}
            {/* Mobile Navigation Bar (fixed at bottom) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex items-center justify-around z-10 shadow-lg md:hidden">
                <Home className="w-6 h-6 cursor-pointer hover:text-gray-700" onClick={() => setCurrentPage('feed')} />
                <Search className="w-6 h-6 cursor-pointer hover:text-gray-700" />
                <PlusSquare className="w-6 h-6 cursor-pointer hover:text-gray-700" onClick={() => setCurrentPage('upload')} />
                <Heart className="w-6 h-6 cursor-pointer hover:text-gray-700" />
                <User className="w-6 h-6 cursor-pointer hover:text-gray-700" onClick={() => setCurrentPage('profile')} />
            </div>
            <MessageBox
                message={messageBox.message}
                type={messageBox.type}
                onClose={() => setMessageBox({ ...messageBox, show: false })}
            />
        </div>
    );
};

export default App;
