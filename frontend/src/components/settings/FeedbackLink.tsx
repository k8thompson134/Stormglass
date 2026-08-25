export default function FeedbackLink() {
  return (
    <div className="border-t border-[#1e2d45] pt-5">
      <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
        Help Us Improve
      </label>
      <a
        href="https://forms.gle/zYUzyjHYSisnc7zJ9"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-between px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 rounded-xl text-blue-300 hover:text-blue-200 transition-colors text-sm font-medium"
      >
        <span>Send Feedback</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 7h10v10" />
          <path d="M7 17L17 7" />
        </svg>
      </a>
      <p className="text-[10px] text-gray-300 mt-2">
        Share your experience and help shape Stormglass
      </p>
    </div>
  );
}
