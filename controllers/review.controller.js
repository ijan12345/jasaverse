import createError from "../utils/createError.js";
import Review from "../models/review.model.js";
import Gig from "../models/gig.model.js";

export const createReview = async (req, res, next) => {
  // Remove the check that prevents sellers from creating a review
  // if (req.isSeller) 
  //   return next(createError(403, "Sellers can't create a review!"));

  const newReview = new Review({
    userId: req.userId,
    gigId: req.body.gigId,
    desc: req.body.desc,
    star: req.body.star,
  });

  try {
    // Check if the user has already created a review for the same gig
    const review = await Review.findOne({
      gigId: req.body.gigId,
      userId: req.userId,
    });

    if (review)
      return next(
        createError(403, "You have already created a review for this gig!")
      );

    // TODO: Check if the user has purchased the gig (if needed)

    // Save the new review
    const savedReview = await newReview.save();

    // Update the gig's ratings with the new review
    await Gig.findByIdAndUpdate(req.body.gigId, {
      $inc: { totalStars: req.body.star, starNumber: 1 },
    });

    // Respond with the saved review
    res.status(201).send(savedReview);
  } catch (err) {
    next(err);
  }
};

export const getReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ gigId: req.params.gigId })
      .populate({ path: "gigId", select: "sellerId" }) // Pastikan ini ada

    console.log("Fetched Reviews:", reviews); // Tambahkan log

    res.status(200).send(reviews);
  } catch (err) {
    next(err);
  }
};


export const deleteReview = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Dapatkan nilai bintang (star) dari review yang akan dihapus
    const starToRemove = review.star;

    // Hapus review
    await Review.findByIdAndDelete(reviewId);

    // Update totalStars dan starNumber pada Gig
    await Gig.findByIdAndUpdate(review.gigId, {
      $inc: {
        totalStars: -starToRemove,  // Kurangi totalStars dengan nilai bintang yang dihapus
        starNumber: -1,             // Kurangi jumlah review
      },
    });

    res.status(200).json({ success: true, message: "Review deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export const likeReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const userId = req.userId.toString();
    let message = "";

    if (review.likedUsers.includes(userId)) {
      // Jika sudah like, maka unlike
      review.likedUsers = review.likedUsers.filter(id => id.toString() !== userId);
      review.likes -= 1;
      message = "Like removed";
    } else {
      // Hapus dari dislikedUsers jika ada
      review.dislikedUsers = review.dislikedUsers.filter(id => id.toString() !== userId);
      review.likedUsers.push(userId);
      review.likes += 1;
      review.dislikes = review.dislikedUsers.length; // Pastikan dislikes dihitung ulang
      message = "Review liked";
    }

    await review.save();
    res.status(200).json({ success: true, message, review });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const dislikeReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const userId = req.userId.toString();
    let message = "";

    if (review.dislikedUsers.includes(userId)) {
      // Jika sudah dislike, maka undislike
      review.dislikedUsers = review.dislikedUsers.filter(id => id.toString() !== userId);
      review.dislikes -= 1;
      message = "Dislike removed";
    } else {
      // Hapus dari likedUsers jika ada
      review.likedUsers = review.likedUsers.filter(id => id.toString() !== userId);
      review.dislikedUsers.push(userId);
      review.dislikes += 1;
      review.likes = review.likedUsers.length; // Pastikan likes dihitung ulang
      message = "Review disliked";
    }

    await review.save();
    res.status(200).json({ success: true, message, review });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
