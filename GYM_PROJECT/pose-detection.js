// Global variables
let detector;
let modelInitialized = false;
let isAnalyzing = false;
let animationId;
let previousPose = null;
let squatCount = 0;
let lastSquatTime = 0;
let isInSquatPosition = false;
let feedbackMessages = [];
const MIN_SQUAT_INTERVAL = 1000; // Minimum time between squats in ms

// DOM elements
const video = document.getElementById('video');
const output = document.getElementById('output');
const canvas = document.getElementById('canvas');
const ctx = output.getContext('2d');
const statusText = document.getElementById('statusText');
const statusIcon = document.getElementById('statusIcon');
const postureStatus = document.getElementById('postureStatus');
const alignmentStatus = document.getElementById('alignmentStatus');
const countStatus = document.getElementById('countStatus');
const feedbackStatus = document.getElementById('feedbackStatus');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

// Initialize the pose detection model
async function initPoseDetection() {
    try {
        statusText.textContent = "Loading AI model...";
        
        // Load the MoveNet model (single pose detection)
        const model = poseDetection.SupportedModels.MoveNet;
        const detectorConfig = {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
            enableSmoothing: true
        };
        
        detector = await poseDetection.createDetector(model, detectorConfig);
        
        statusText.textContent = "AI model loaded. Click Start Analysis.";
        statusIcon.innerHTML = '<i class="fa fa-check-circle"></i>';
        modelInitialized = true;
    } catch (error) {
        console.error("Error loading model:", error);
        statusText.textContent = "Error loading AI model. Please refresh.";
        statusIcon.innerHTML = '<i class="fa fa-times-circle"></i>';
    }
}

// Start video and pose detection
async function startAnalysis() {
    if (!modelInitialized) {
        alert("AI model is still loading. Please wait.");
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" },
            audio: false
        });
        video.srcObject = stream;
        
        output.width = video.videoWidth;
        output.height = video.videoHeight;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        isAnalyzing = true;
        squatCount = 0;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        statusText.textContent = "Analyzing squats in real-time...";
        statusIcon.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
        countStatus.textContent = "0";
        feedbackStatus.textContent = "Stand straight to begin";
        
        detectPose();
    } catch (error) {
        console.error("Error accessing camera:", error);
        statusText.textContent = "Error accessing camera. Please allow permissions.";
        statusIcon.innerHTML = '<i class="fa fa-times-circle"></i>';
    }
}

// Stop analysis
function stopAnalysis() {
    isAnalyzing = false;
    cancelAnimationFrame(animationId);
    
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusText.textContent = "Analysis stopped. Click Start to begin.";
    statusIcon.innerHTML = '<i class="fa fa-pause-circle"></i>';
    
    // Clear canvas
    ctx.clearRect(0, 0, output.width, output.height);
}

// Detect pose in real-time
async function detectPose() {
    if (!isAnalyzing) return;
    
    try {
        const poses = await detector.estimatePoses(video);
        drawPose(poses[0]); // We're only analyzing single pose
        
        if (poses && poses.length > 0) {
            analyzeSquat(poses[0]);
        } else {
            postureStatus.textContent = "No person detected";
            postureStatus.className = "feedback-value warning";
        }
        
        animationId = requestAnimationFrame(detectPose);
    } catch (error) {
        console.error("Error detecting pose:", error);
        stopAnalysis();
    }
}

// Draw pose on canvas
function drawPose(pose) {
    ctx.clearRect(0, 0, output.width, output.height);
    
    if (!pose) return;
    
    // Draw keypoints
    pose.keypoints.forEach(keypoint => {
        if (keypoint.score > 0.3) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = "aqua";
            ctx.fill();
        }
    });
    
    // Draw skeleton
    const adjacentKeyPoints = [
        ['left_shoulder', 'right_shoulder'], // Shoulders
        ['left_shoulder', 'left_elbow'],
        ['left_elbow', 'left_wrist'],
        ['right_shoulder', 'right_elbow'],
        ['right_elbow', 'right_wrist'],
        ['left_shoulder', 'left_hip'],
        ['right_shoulder', 'right_hip'],
        ['left_hip', 'right_hip'], // Hips
        ['left_hip', 'left_knee'],
        ['left_knee', 'left_ankle'],
        ['right_hip', 'right_knee'],
        ['right_knee', 'right_ankle']
    ];
    
    adjacentKeyPoints.forEach(points => {
        const kp1 = pose.keypoints.find(kp => kp.name === points[0]);
        const kp2 = pose.keypoints.find(kp => kp.name === points[1]);
        
        if (kp1 && kp2 && kp1.score > 0.3 && kp2.score > 0.3) {
            ctx.beginPath();
            ctx.moveTo(kp1.x, kp1.y);
            ctx.lineTo(kp2.x, kp2.y);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "aqua";
            ctx.stroke();
        }
    });
}

// Analyze squat form and count repetitions
function analyzeSquat(pose) {
    if (!pose) return;
    
    // Get keypoints
    const keypoints = {};
    pose.keypoints.forEach(kp => {
        if (kp.score > 0.3) keypoints[kp.name] = kp;
    });
    
    // Check if we have enough keypoints
    const requiredKeypoints = ['left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'];
    const hasRequired = requiredKeypoints.every(kp => keypoints[kp]);
    
    if (!hasRequired) {
        postureStatus.textContent = "Not enough data";
        postureStatus.className = "feedback-value warning";
        return;
    }
    
    // Calculate average positions for bilateral body parts
    const hip = {
        x: (keypoints.left_hip.x + keypoints.right_hip.x) / 2,
        y: (keypoints.left_hip.y + keypoints.right_hip.y) / 2
    };
    
    const knee = {
        x: (keypoints.left_knee.x + keypoints.right_knee.x) / 2,
        y: (keypoints.left_knee.y + keypoints.right_knee.y) / 2
    };
    
    const ankle = {
        x: (keypoints.left_ankle.x + keypoints.right_ankle.x) / 2,
        y: (keypoints.left_ankle.y + keypoints.right_ankle.y) / 2
    };
    
    // Calculate angles for form analysis
    const kneeAngle = calculateAngle(hip, knee, ankle);
    const torsoAngle = keypoints.nose && keypoints.left_shoulder && keypoints.right_shoulder ? 
        calculateAngle(
            {x: (keypoints.left_shoulder.x + keypoints.right_shoulder.x) / 2, 
             y: (keypoints.left_shoulder.y + keypoints.right_shoulder.y) / 2},
            hip,
            knee
        ) : null;
    
    // Check squat depth (knee angle)
    if (kneeAngle < 100) {
        // In squat position
        if (!isInSquatPosition) {
            isInSquatPosition = true;
            feedbackMessages = []; // Reset feedback for new squat
        }
        
        // Check form during squat
        checkSquatForm(keypoints, kneeAngle, torsoAngle);
    } else if (kneeAngle > 160 && isInSquatPosition) {
        // Completed a squat
        isInSquatPosition = false;
        const now = Date.now();
        
        // Only count if enough time has passed since last squat
        if (now - lastSquatTime > MIN_SQUAT_INTERVAL) {
            squatCount++;
            countStatus.textContent = squatCount;
            lastSquatTime = now;
            
            // Provide feedback on the completed squat
            if (feedbackMessages.length > 0) {
                feedbackStatus.textContent = "Last squat: " + feedbackMessages.join(", ");
                feedbackStatus.className = feedbackMessages.some(m => m.includes("Poor")) ? 
                    "feedback-value warning" : "feedback-value correct";
            } else {
                feedbackStatus.textContent = "Good squat!";
                feedbackStatus.className = "feedback-value correct";
            }
        }
    }
    
    // Update posture status based on current position
    updatePostureStatus(keypoints, kneeAngle, torsoAngle);
}

// Check squat form during execution
function checkSquatForm(keypoints, kneeAngle, torsoAngle) {
    const feedback = [];
    
    // 1. Knee alignment (shouldn't go past toes)
    const ankle = {
        x: (keypoints.left_ankle.x + keypoints.right_ankle.x) / 2,
        y: (keypoints.left_ankle.y + keypoints.right_ankle.y) / 2
    };
    
    const knee = {
        x: (keypoints.left_knee.x + keypoints.right_knee.x) / 2,
        y: (keypoints.left_knee.y + keypoints.right_knee.y) / 2
    };
    
    if (knee.x < ankle.x - 20) {
        feedback.push("Poor: Knees too far forward");
    }
    
    // 2. Torso angle (should maintain upright position)
    if (torsoAngle && torsoAngle < 70) {
        feedback.push("Poor: Leaning too far forward");
    }
    
    // 3. Knee valgus (knees collapsing inward)
    const leftKneeAngle = calculateAngle(
        keypoints.left_hip, 
        keypoints.left_knee, 
        keypoints.left_ankle
    );
    
    const rightKneeAngle = calculateAngle(
        keypoints.right_hip, 
        keypoints.right_knee, 
        keypoints.right_ankle
    );
    
    if (leftKneeAngle < 165 || rightKneeAngle < 165) {
        feedback.push("Poor: Knees collapsing inward");
    }
    
    feedbackMessages = feedback;
}

// Update posture status UI
function updatePostureStatus(keypoints, kneeAngle, torsoAngle) {
    if (isInSquatPosition) {
        if (feedbackMessages.length > 0) {
            postureStatus.textContent = "IMPROPER FORM";
            postureStatus.className = "feedback-value warning";
            alignmentStatus.textContent = feedbackMessages.join("; ");
            alignmentStatus.className = "feedback-value warning";
        } else {
            postureStatus.textContent = "GOOD SQUAT FORM";
            postureStatus.className = "feedback-value correct";
            alignmentStatus.textContent = "Depth: " + Math.round(180 - kneeAngle) + "°";
            alignmentStatus.className = "feedback-value correct";
        }
    } else {
        if (kneeAngle > 160) {
            postureStatus.textContent = "READY FOR SQUAT";
            postureStatus.className = "feedback-value correct";
            alignmentStatus.textContent = "Stand straight, feet shoulder-width";
            alignmentStatus.className = "feedback-value";
        } else {
            postureStatus.textContent = "IN SQUAT POSITION";
            postureStatus.className = "feedback-value";
            alignmentStatus.textContent = "Depth: " + Math.round(180 - kneeAngle) + "°";
            alignmentStatus.className = "feedback-value";
        }
    }
}

// Calculate angle between three points
function calculateAngle(a, b, c) {
    const ab = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
    const bc = Math.sqrt(Math.pow(b.x - c.x, 2) + Math.pow(b.y - c.y, 2));
    const ac = Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2));
    return Math.acos((ab * ab + bc * bc - ac * ac) / (2 * ab * bc)) * (180 / Math.PI);
}

// Event listeners
startBtn.addEventListener('click', startAnalysis);
stopBtn.addEventListener('click', stopAnalysis);

// Initialize when page loads
window.addEventListener('load', () => {
    initPoseDetection();
});