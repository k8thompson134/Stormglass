
export default function Sidebar() {
    const menuItems = [
        { name: 'Dashboard', icon: '📊', active: true },
        { name: 'Health', icon: '🏥', active: false },
        { name: 'Forecast', icon: '☀️', active: false },
        { name: 'History', icon: '📅', active: false },
        { name: 'Settings', icon: '⚙️', active: false },
    ];

    return (
        <aside className="fixed left-0 top-0 h-screen w-20 flex flex-col items-center py-8 bg-gray-900/50 backdrop-blur-xl border-r border-gray-800">
            <div className="mb-10 text-blue-500 font-bold text-2xl tracking-tighter">Sg.</div>
            <nav className="flex flex-col gap-6 w-full px-4">
                {menuItems.map((item) => (
                    <button
                        key={item.name}
                        className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all duration-300 group relative
              ${item.active
                                ? 'bg-blue-600/20 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.3)]'
                                : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                            }`}
                    >
                        <span className="text-2xl filter grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
                        {item.active && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full -ml-[18px]" />
                        )}
                        <span className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-gray-700">
                            {item.name}
                        </span>
                    </button>
                ))}
            </nav>
        </aside>
    );
}
